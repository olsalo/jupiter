import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"
import { createTRPCClient, httpLink } from "@trpc/client"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import superjson from "superjson"
import type { AppRouter } from "../app/.server/main"

process.env.NODE_ENV = "test"
const vite = await createServer({
  configFile: false,
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, hmr: false, watch: null },
})
const { prisma } = await vite.ssrLoadModule("/app/lib/prisma.server.ts") as typeof import("../app/lib/prisma.server")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
const originalFetch = globalThis.fetch
const originalEnv = { ...process.env }
const deliveries: { to: string, body: string }[] = []
const suffix = randomUUID()
const userIds: string[] = []
const organizationIds: string[] = []
let failDelivery = false

try {
  process.env.EMAIL_PROVIDER = "plunk"
  process.env.PLUNK_API_KEY = "test-key"
  process.env.EMAIL_FROM = "test@example.invalid"
  process.env.BETTER_AUTH_URL = "https://example.invalid"
  delete process.env.EMAIL_OVERRIDE_TO
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://next-api.useplunk.com/v1/send")
    deliveries.push(JSON.parse(String(options?.body)))
    return new Response(JSON.stringify({ success: !failDelivery }), { status: failDelivery ? 500 : 200 })
  }
  const organization = await prisma.organization.create({ data: { name: "Notifications", slug: suffix, createdAt: new Date() } })
  organizationIds.push(organization.id)
  const other = await prisma.organization.create({ data: { name: "Other", slug: `other-${suffix}`, createdAt: new Date() } })
  organizationIds.push(other.id)
  const users = []
  for (const [index, preference, verified, orgId] of [
    [0, false, true, organization.id],
    [1, true, true, organization.id],
    [2, true, false, organization.id],
    [3, true, true, other.id],
  ] as const) {
    const user = await prisma.user.create({ data: {
      name: "Notification test", email: `notify-${index}-${suffix}@example.invalid`,
      emailVerified: verified, newResponseEmail: preference, locale: "fi",
      members: { create: { organizationId: orgId, role: "member", createdAt: new Date() } },
    } })
    users.push(user)
    userIds.push(user.id)
  }
  const ctx = {
    headers: new Headers(), request: undefined, prisma, user: users[0], session: undefined,
    organizationId: organization.id, formatLocale: "fi-FI", formatPreference: "eu" as const, locale: "en" as const,
  }
  const caller = appRouter.createCaller(ctx)
  const publicCaller = appRouter.createCaller({ ...ctx, user: undefined, organizationId: null })
  const cookies = await vite.ssrLoadModule("/app/lib/cookies.server.ts") as typeof import("../app/lib/cookies.server")
  let responseCookies: string[] = []
  const preferenceClient = createTRPCClient<AppRouter>({ links: [httpLink({
    url: "https://example.invalid/api/trpc",
    transformer: superjson,
    fetch: async (url, options) => {
      const response = await fetchRequestHandler({
        endpoint: "/api/trpc",
        req: new Request(String(url), options),
        router: appRouter,
        createContext: ({ resHeaders }) => ({ ...ctx, responseHeaders: resHeaders }),
      })
      responseCookies = response.headers.getSetCookie()
      return response
    },
  })] })
  await preferenceClient.profile.updatePreferences.mutate({ locale: "fi", theme: "dark", formatPreference: "us" })
  assert.equal(responseCookies.length, 3, "All preference cookies must survive the HTTP response")
  assert.equal(await cookies.localeCookie.parse(responseCookies.find((cookie) => cookie.startsWith("lng="))!), "fi")
  assert.equal(await cookies.themeCookie.parse(responseCookies.find((cookie) => cookie.startsWith("theme="))!), "dark")
  assert.equal(await cookies.formatPreferenceCookie.parse(responseCookies.find((cookie) => cookie.startsWith("format="))!), "us")
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: users[0].id } })).locale, "fi")
  await assert.rejects(publicCaller.profile.updatePreferences({ theme: "dark" }), { code: "UNAUTHORIZED" })
  console.info("PASS preference mutations persist language and return locale, theme, and format cookies through HTTP")
  assert.deepEqual(await caller.profile.notifications(), { newResponseEmail: false })
  await assert.rejects(publicCaller.profile.updateNotifications({ newResponseEmail: true }), { code: "UNAUTHORIZED" })
  await caller.profile.updateNotifications({ newResponseEmail: true })
  assert.equal((await caller.profile.notifications()).newResponseEmail, true)
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: users[2].id } })).newResponseEmail, true)
  await caller.profile.updateNotifications({ newResponseEmail: false })
  const form = await caller.forms.create()
  const draft = await caller.forms.get({ id: form.id })
  const saved = await caller.forms.saveDraft({ id: form.id, revision: draft.draftRevision, title: '<Test & "form">', sections: draft.sections.map((section) => ({ id: section.id, items: [] })) })
  const version = await caller.forms.publish({ id: form.id, revision: saved.draftRevision })
  const input = { id: form.id, versionId: version.versionId, values: { respondentEmail: "" } }
  await publicCaller.publicForms.submit(input)
  assert.equal(deliveries.length, 1)
  assert.equal(deliveries[0].to, users[1].email)
  assert.match(deliveries[0].body, /Uusi lomakevastaus/)
  assert.match(deliveries[0].body, /&lt;Test &amp; &quot;form&quot;&gt;/)
  assert.ok(deliveries[0].body.includes(`/forms/${form.id}/responses`))
  await assert.rejects(publicCaller.publicForms.submit({ ...input, versionId: "invalid" }))
  assert.equal(deliveries.length, 1, "Rejected submissions must not notify")
  failDelivery = true
  const response = await publicCaller.publicForms.submit(input)
  assert.ok(await prisma.formSubmission.findUnique({ where: { id: response.submissionId } }))
  assert.equal(deliveries.length, 2)
  await prisma.user.update({ where: { id: users[1].id }, data: { newResponseEmail: false } })
  await publicCaller.publicForms.submit(input)
  assert.equal(deliveries.length, 2, "Opting out stops delivery")
  console.info("PASS notification preferences, authentication, recipient isolation, localization, rejected submissions, and delivery failure isolation")
} finally {
  globalThis.fetch = originalFetch
  for (const key of ["EMAIL_PROVIDER", "PLUNK_API_KEY", "EMAIL_FROM", "BETTER_AUTH_URL", "EMAIL_OVERRIDE_TO"]) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } })
  await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  await prisma.$disconnect()
  await vite.close()
}
