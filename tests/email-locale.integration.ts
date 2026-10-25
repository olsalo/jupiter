import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
process.env.EMAIL_PROVIDER = ""
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/email-locale", appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { ws: false, middlewareMode: true, hmr: false, watch: null } })
const { auth } = await vite.ssrLoadModule("/app/lib/auth/server.ts") as typeof import("../app/lib/auth/server")
const { prisma } = await vite.ssrLoadModule("/app/lib/prisma.server.ts") as typeof import("../app/lib/prisma.server")
const { getEmailLocale } = await vite.ssrLoadModule("/app/lib/auth/email-locale.server.ts") as typeof import("../app/lib/auth/email-locale.server")
const { localeCookie } = await vite.ssrLoadModule("/app/lib/cookies.server.ts") as typeof import("../app/lib/cookies.server")
const { createTRPCContext } = await vite.ssrLoadModule("/app/.server/trpc.ts") as typeof import("../app/.server/trpc")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
let userId: string | undefined
let organizationId: string | undefined
const originalFetch = globalThis.fetch
try {
  const origin = "http://localhost:5175"
  const selectedCookie = async (locale: string) => (await localeCookie.serialize(locale)).split(";")[0]
  const request = (headers: Headers) => new Request(`${origin}/api/auth/email-otp/send-verification-otp`, { headers })
  const guestHeaders = new Headers({ origin, host: "localhost:5175", "accept-language": "en" })
  guestHeaders.set("cookie", await selectedCookie("fi"))
  assert.equal(await getEmailLocale(request(guestHeaders)), "fi")
  guestHeaders.set("cookie", await selectedCookie("en"))
  guestHeaders.set("accept-language", "fi")
  assert.equal(await getEmailLocale(request(guestHeaders)), "en")
  assert.equal(await getEmailLocale(), "en")
  const guestResponseHeaders = new Headers()
  const guest = appRouter.createCaller(await createTRPCContext({ headers: guestHeaders, responseHeaders: guestResponseHeaders }))
  await guest.profile.updateLocale({ locale: "fi" })
  assert.equal(await localeCookie.parse(guestResponseHeaders.get("set-cookie")!.split(";")[0]), "fi")

  const email = `email-locale-${randomUUID()}@example.invalid`
  const otp = await auth.api.createVerificationOTP({ body: { email, type: "sign-in" }, headers: guestHeaders })
  const signedIn = await auth.api.signInEmailOTP({ headers: guestHeaders, body: { email, otp }, returnHeaders: true })
  userId = signedIn.response.user.id
  await prisma.user.update({ where: { id: userId }, data: { locale: "fi" } })
  const headers = new Headers(guestHeaders)
  headers.set("cookie", [...signedIn.headers.getSetCookie().map((cookie) => cookie.split(";")[0]), await selectedCookie("en")].join("; "))
  headers.set("accept-language", "en")
  assert.equal(await getEmailLocale(request(headers)), "fi", "Signed-in account locale wins over the cookie and browser language")
  const responseHeaders = new Headers()
  const context = await createTRPCContext({ headers, responseHeaders })
  assert.equal(context.locale, "fi")
  await appRouter.createCaller(context).profile.updateLocale({ locale: "en" })
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).locale, "en")
  assert.equal(await localeCookie.parse(responseHeaders.get("set-cookie")!.split(";")[0]), "en")
  headers.set("cookie", [...signedIn.headers.getSetCookie().map((cookie) => cookie.split(";")[0]), await selectedCookie("fi")].join("; "))
  assert.equal(await getEmailLocale(request(headers)), "en", "A stale cookie cannot overwrite a saved language change")

  const delivered: Record<string, unknown>[] = []
  globalThis.fetch = async (_input, init) => {
    delivered.push(JSON.parse(String(init?.body)))
    return Response.json({ success: true })
  }
  process.env.EMAIL_PROVIDER = "plunk"
  process.env.PLUNK_API_KEY = "test-key"
  process.env.EMAIL_FROM = "Jupiter <verified@example.invalid>"
  await auth.api.sendVerificationOTP({ headers, body: { email, type: "email-verification" } })
  assert.equal(delivered.at(-1)?.subject, "Your email verification code")
  await auth.api.sendVerificationOTP({ headers: guestHeaders, body: { email, type: "forget-password" } })
  assert.equal(delivered.at(-1)?.subject, "Your password reset code", "Signed-out requests use the selected cookie even for an existing account")
  guestHeaders.set("cookie", await selectedCookie("fi"))
  await auth.api.sendVerificationOTP({ headers: guestHeaders, body: { email, type: "sign-in" } })
  assert.equal(delivered.at(-1)?.subject, "Kirjautumiskoodisi")
  const organization = await prisma.organization.create({ data: { name: "Locale invitation test", slug: `locale-${randomUUID()}`, createdAt: new Date(), members: { create: { userId, role: "owner", createdAt: new Date() } } } })
  organizationId = organization.id
  await auth.api.createInvitation({ headers, body: { organizationId, email: `invite-en-${randomUUID()}@example.invalid`, role: "member" } })
  assert.equal(delivered.at(-1)?.subject, "You're invited to join Locale invitation test")
  await prisma.user.update({ where: { id: userId }, data: { locale: "fi" } })
  headers.set("cookie", [...signedIn.headers.getSetCookie().map((cookie) => cookie.split(";")[0]), await selectedCookie("en")].join("; "))
  await auth.api.createInvitation({ headers, body: { organizationId, email: `invite-fi-${randomUUID()}@example.invalid`, role: "member" } })
  assert.equal(delivered.at(-1)?.subject, "Sinut on kutsuttu tiimiin Locale invitation test")
  console.info("PASS guest cookie language, signed-in saved locale, database/cookie sync, stale-cookie precedence, tRPC locale and actual OTP/invitation callback language selection with mocked delivery")
} finally {
  globalThis.fetch = originalFetch
  try {
    if (organizationId) await prisma.organization.delete({ where: { id: organizationId } })
    if (userId) await prisma.user.delete({ where: { id: userId } })
  } finally {
    await prisma.$disconnect()
    await vite.close()
  }
}
