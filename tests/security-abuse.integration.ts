import assert from "node:assert/strict"
import { S3Client } from "@aws-sdk/client-s3"
import sharp from "sharp"
import { createServer } from "vite"
import type { Prisma, PrismaClient } from "../generated/prisma/client"
import type { createTRPCContext } from "../app/.server/trpc"

process.env.NODE_ENV = "production"
process.env.BETTER_AUTH_SECRET = "isolated-security-regression-secret-at-least-32-characters"
process.env.BETTER_AUTH_URL = "https://audit.example.invalid"
process.env.STRIPE_SECRET_KEY = ""
process.env.DEMO_BYPASS_ONBOARDING_PAYMENT = "true"
delete process.env.TRUSTED_CLIENT_IP_HEADER
delete process.env.BOOKING_TRUSTED_IP_HEADER

type Counter = { id: string; identifier: string; value: string; expiresAt: Date }
type ObjectInfo = { Key: string; Size: number; LastModified: Date }
const counters = new Map<string, Counter>()
let subscriptions: Record<string, unknown>[] = []
let writes = 0
let membership = true
let acquireUploadLock = true
let deliveries = 0
let pages: { metadata: { imageKey: string } }[] = []
const objects = new Map<string, ObjectInfo>()
const database = {} as PrismaClient
let queue = Promise.resolve()
Object.assign(database, {
  async $transaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>) {
    const previous = queue
    let release = () => {}
    queue = new Promise<void>((resolve) => { release = resolve })
    await previous
    const snapshot = new Map(counters)
    try {
      return await run(database)
    } catch (error) {
      counters.clear()
      for (const [key, value] of snapshot) counters.set(key, value)
      throw error
    } finally {
      release()
    }
  },
  $queryRaw: async () => [{ acquired: acquireUploadLock }],
  verification: {
    findUnique: async ({ where }: { where: { id: string } }) => counters.get(where.id) ?? null,
    upsert: async ({ where, create, update }: { where: { id: string }; create: Counter; update: Partial<Counter> }) => {
      const value = counters.has(where.id) ? { ...counters.get(where.id)!, ...update } : create
      counters.set(where.id, value)
      return value
    },
  },
  member: { findFirst: async () => membership ? { id: "member", role: "owner", organization: { id: "org", settings: {} }, staffProfile: null } : null },
  organization: { findUnique: async () => ({ id: "org", settings: { bookingEnabled: true } }) },
  subscription: { findMany: async () => subscriptions },
  customer: { create: async ({ data }: { data: object }) => { writes++; return { id: "customer", ...data } } },
  user: { update: async ({ data }: { data: object }) => data },
  bookingPage: { findMany: async () => pages },
})
Object.assign(globalThis, { securityTestDatabase: database, securityTestDelivery: () => { deliveries++ } })

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/security-abuse",
  appType: "custom",
  resolve: { alias: { "~": appPath } },
  plugins: [{
    name: "isolated-security-services",
    transform(code, id) {
      if (id === `${appPath}/lib/database/prisma.server.ts`) return "export const prisma = globalThis.securityTestDatabase"
      if (id === `${appPath}/lib/email/email.server.ts`) return "export const emailOtpExpiresInMinutes = 5\nexport async function sendOtpEmail() { globalThis.securityTestDelivery() }\nexport async function sendEmail() {}"
      if (id === `${appPath}/lib/auth/server.ts`) return code.replace(
        'import { prismaAdapter } from "better-auth/adapters/prisma"',
        'import { memoryAdapter } from "better-auth/adapters/memory"\nconst prismaAdapter = () => memoryAdapter({ user: [], session: [], verification: [], account: [] })',
      )
    },
  }],
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})
const originalSend = S3Client.prototype.send
try {
  const { auth } = await vite.ssrLoadModule("/app/lib/auth/server.ts") as typeof import("../app/lib/auth/server")
  const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
  const { consumeRequestBudgets, otpRequestBudgets } = await vite.ssrLoadModule("/app/.server/services/request-budget.ts") as typeof import("../app/.server/services/request-budget")
  const { bookingClientKey, limitBookingLookup } = await vite.ssrLoadModule("/app/.server/services/booking-rate-limit.ts") as typeof import("../app/.server/services/booking-rate-limit")
  const { resolveBookingPage } = await vite.ssrLoadModule("/app/.server/services/booking-page.ts") as typeof import("../app/.server/services/booking-page")
  const { isSubscriptionEntitled } = await vite.ssrLoadModule("/app/lib/billing/billing.ts") as typeof import("../app/lib/billing/billing")

  process.env.STRIPE_SECRET_KEY = "sk_test_isolated"
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_isolated"
  process.env.STRIPE_PRO_PRICE_ID = "price_isolated"
  const context = { prisma: database, headers: new Headers(), user: { id: "user" }, session: { activeOrganizationId: "org" }, organizationId: "org", locale: "en", formatLocale: "en-GB", formatPreference: "eu" } as Awaited<ReturnType<typeof createTRPCContext>>
  const caller = appRouter.createCaller(context)
  await assert.rejects(caller.customer.create({ firstName: "Audit" }), { code: "FORBIDDEN" })
  await assert.rejects(caller.bookingPage.uploadImage({ base64: "YQ==" }), { code: "FORBIDDEN" })
  await assert.rejects(resolveBookingPage(database, { organizationSlug: "org" }), { code: "FORBIDDEN" })
  assert.equal(writes, 0, "Expired organizations cannot write, even with the demo flag enabled in production")
  assert.deepEqual(await caller.billing.subscriptions(), [], "Billing recovery remains available")
  assert.deepEqual(await caller.profile.updateName({ name: "Owner" }), { name: "Owner" })
  const active = { status: "active", periodEnd: new Date(Date.now() + 86400000), cancelAt: null, cancelAtPeriodEnd: false, canceledAt: null, endedAt: null }
  subscriptions = [active]
  await caller.customer.create({ firstName: "Audit" })
  assert.equal(writes, 1)
  membership = false
  await assert.rejects(caller.customer.create({ firstName: "Audit" }), { code: "FORBIDDEN" })
  membership = true
  assert.equal(isSubscriptionEntitled({ ...active, periodEnd: new Date(0) }), false)
  assert.equal(isSubscriptionEntitled({ ...active, cancelAtPeriodEnd: true, cancelAt: active.periodEnd, canceledAt: new Date() }), true, "Scheduled cancellation retains paid access until expiry")
  process.env.STRIPE_SECRET_KEY = ""
  subscriptions = []
  await caller.customer.create({ firstName: "Local" })
  assert.equal(writes, 2, "Billing-disabled installations remain usable")
  console.info("PASS subscription API enforcement, public booking gate, membership checks and recovery access")

  const origin = process.env.BETTER_AUTH_URL!
  const sendOtp = async (ip: string) => auth.handler(new Request(`${origin}/api/auth/email-otp/send-verification-otp`, {
    method: "POST", headers: { origin, "content-type": "application/json", "x-forwarded-for": ip, "x-real-ip": ip },
    body: JSON.stringify({ email: "audit@example.invalid", type: "sign-in" }),
  }))
  assert.equal((await sendOtp("192.0.2.1")).status, 200)
  const savedOtp = await auth.api.getVerificationOTP({ query: { email: "audit@example.invalid", type: "sign-in" } })
  assert.equal((await sendOtp("192.0.2.2")).status, 429)
  assert.deepEqual(await auth.api.getVerificationOTP({ query: { email: "audit@example.invalid", type: "sign-in" } }), savedOtp, "Rejected sends preserve the already-issued OTP")
  const disguised = await auth.handler(new Request(`${origin}/api/auth/email-otp/send-verification-otp`, {
    method: "POST", headers: { origin, "content-type": "application/json", "x-real-ip": "192.0.2.3" },
    body: JSON.stringify({ email: "audit@example.invalid", newEmail: "other@example.invalid", type: "sign-in" }),
  }))
  assert.equal(disguised.status, 429, "Unrelated fields cannot change which recipient is limited")
  const legacyReset = await auth.handler(new Request(`${origin}/api/auth/forget-password/email-otp`, {
    method: "POST", headers: { origin, "content-type": "application/json", "x-real-ip": "192.0.2.4" },
    body: JSON.stringify({ email: "audit@example.invalid" }),
  }))
  assert.equal(legacyReset.status, 429, "Legacy OTP delivery paths share recipient limits")
  assert.equal(deliveries, 1, "Rotating IPs cannot bypass the recipient cooldown")
  assert.deepEqual(otpRequestBudgets(" AUDIT@example.invalid "), otpRequestBudgets("audit@example.invalid"))
  const now = new Date()
  const budget = [{ key: "concurrent-test", maximum: 1, windowMs: 1000 }]
  const concurrent = await Promise.allSettled([consumeRequestBudgets(database, budget, now), consumeRequestBudgets(database, budget, now)])
  assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1)
  await consumeRequestBudgets(database, budget, new Date(+now + 1001))
  const allOrNothing = [{ key: "must-roll-back", maximum: 5, windowMs: 1000 }, ...budget]
  await assert.rejects(consumeRequestBudgets(database, allOrNothing, new Date(+now + 1002)), { code: "TOO_MANY_REQUESTS" })
  await consumeRequestBudgets(database, [{ key: "must-roll-back", maximum: 1, windowMs: 1000 }], new Date(+now + 1002))
  counters.clear()
  for (let i = 0; i < 5; i++) await consumeRequestBudgets(database, otpRequestBudgets("hourly@example.invalid"), new Date(+now + i * 61000))
  await assert.rejects(consumeRequestBudgets(database, otpRequestBudgets("hourly@example.invalid"), new Date(+now + 5 * 61000)), { code: "TOO_MANY_REQUESTS" })
  for (let i = 0; i < 5; i++) await consumeRequestBudgets(database, otpRequestBudgets("hourly@example.invalid"), new Date(+now + 3600001 + i * 61000))
  await assert.rejects(consumeRequestBudgets(database, otpRequestBudgets("hourly@example.invalid"), new Date(+now + 7200002)), { code: "TOO_MANY_REQUESTS" })
  counters.clear()
  for (let i = 0; i < 200; i++) await consumeRequestBudgets(database, otpRequestBudgets(`recipient-${i}@example.invalid`), now)
  await assert.rejects(consumeRequestBudgets(database, otpRequestBudgets("extra@example.invalid"), now), { code: "TOO_MANY_REQUESTS" })
  counters.clear()
  console.info("PASS OTP recipient throttling before token creation, counter expiry, concurrency and atomic budget rollback")

  assert.throws(() => bookingClientKey(new Headers()), { code: "PRECONDITION_FAILED" })
  assert.throws(() => bookingClientKey(new Headers({ "x-forwarded-for": "192.0.2.1" })), { code: "PRECONDITION_FAILED" })
  assert.throws(() => bookingClientKey(new Headers({ "x-real-ip": "192.0.2.1, 198.51.100.1" })), { code: "PRECONDITION_FAILED" })
  process.env.TRUSTED_CLIENT_IP_HEADER = "x-client-ip"
  assert.ok(bookingClientKey(new Headers({ "x-client-ip": "192.0.2.1" })), "The environment can override the default header")
  assert.throws(() => bookingClientKey(new Headers({ "x-real-ip": "192.0.2.1" })), { code: "PRECONDITION_FAILED" })
  delete process.env.TRUSTED_CLIENT_IP_HEADER
  const client = (ip: string) => new Headers({ "x-real-ip": ip })
  for (let i = 0; i < 120; i++) await limitBookingLookup(database, client("192.0.2.1"))
  await assert.rejects(limitBookingLookup(database, client("192.0.2.1")), { code: "TOO_MANY_REQUESTS" })
  await limitBookingLookup(database, client("192.0.2.2"))
  process.env.NODE_ENV = "development"
  for (let i = 0; i < 121; i++) await limitBookingLookup(database, new Headers())
  process.env.NODE_ENV = "production"
  console.info("PASS trusted-header validation and independent booking client buckets with no shared unknown bucket")

  Object.assign(process.env, { S3_ENDPOINT: "http://127.0.0.1:9000", S3_BUCKET: "isolated", S3_ACCESS_KEY_ID: "isolated", S3_SECRET_ACCESS_KEY: "isolated" })
  S3Client.prototype.send = (async (command: { constructor: { name: string }; input: { Prefix?: string; Key?: string; Body?: Buffer } }) => {
    if (command.constructor.name === "ListObjectsV2Command") return { Contents: [...objects.values()].filter((object) => object.Key.startsWith(command.input.Prefix!)) }
    if (command.constructor.name === "PutObjectCommand") objects.set(command.input.Key!, { Key: command.input.Key!, Size: command.input.Body!.length, LastModified: new Date() })
    if (command.constructor.name === "DeleteObjectCommand") objects.delete(command.input.Key!)
    return {}
  }) as typeof originalSend
  const { uploadBookingImage, pruneBookingImages } = await vite.ssrLoadModule("/app/.server/services/booking-image-upload.ts") as typeof import("../app/.server/services/booking-image-upload")
  const { uploadImage } = await vite.ssrLoadModule("/app/lib/storage/image-upload.server.ts") as typeof import("../app/lib/storage/image-upload.server")
  const base64 = (await sharp({ create: { width: 60, height: 30, channels: 3, background: "#ffffff" } }).png().toBuffer()).toString("base64")
  for (let i = 0; i < 20; i++) objects.set(`booking-pages/full/${i}.avif`, { Key: `booking-pages/full/${i}.avif`, Size: 100, LastModified: now })
  await assert.rejects(uploadBookingImage(database, "full", base64), { code: "FORBIDDEN" })
  objects.set("booking-pages/large/a.avif", { Key: "booking-pages/large/a.avif", Size: 30 * 1024 * 1024, LastModified: now })
  await assert.rejects(uploadBookingImage(database, "large", base64), { code: "FORBIDDEN" })
  acquireUploadLock = false
  await assert.rejects(uploadBookingImage(database, "busy", base64), { code: "TOO_MANY_REQUESTS" })
  acquireUploadLock = true
  for (let i = 0; i < 3; i++) await uploadBookingImage(database, "allowed", base64)
  await assert.rejects(uploadBookingImage(database, "allowed", base64), { code: "TOO_MANY_REQUESTS" })
  const old = new Date(+now - 25 * 3600000)
  for (const [key, lastModified] of [["booking-pages/cleanup/live.avif", old], ["booking-pages/cleanup/orphan.avif", old], ["booking-pages/cleanup/new.avif", now], ["booking-pages/other/keep.avif", old]] as const) objects.set(key, { Key: key, Size: 100, LastModified: lastModified })
  pages = [{ metadata: { imageKey: "booking-pages/cleanup/live.avif" } }]
  await pruneBookingImages(database, "cleanup", now)
  assert.equal(objects.has("booking-pages/cleanup/orphan.avif"), false)
  for (const key of ["booking-pages/cleanup/live.avif", "booking-pages/cleanup/new.avif", "booking-pages/other/keep.avif"]) assert.equal(objects.has(key), true)
  const first = uploadImage({ organizationId: "concurrency", folder: "booking-pages", base64 })
  const second = uploadImage({ organizationId: "concurrency", folder: "booking-pages", base64 })
  await assert.rejects(uploadImage({ organizationId: "concurrency", folder: "booking-pages", base64 }), { code: "TOO_MANY_REQUESTS" })
  await Promise.all([first, second])
  await assert.rejects(uploadImage({ organizationId: "concurrency", folder: "booking-pages", base64: "invalid" }), { code: "BAD_REQUEST" })
  await uploadImage({ organizationId: "concurrency", folder: "booking-pages", base64 })
  console.info("PASS image rate, object-count, byte and concurrency limits, encoder release and scoped orphan cleanup")
} finally {
  S3Client.prototype.send = originalSend
  await vite.close()
  Reflect.deleteProperty(globalThis, "securityTestDatabase")
  Reflect.deleteProperty(globalThis, "securityTestDelivery")
}
