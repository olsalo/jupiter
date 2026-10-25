import "dotenv/config"
import assert from "node:assert/strict"
import { timeoutManager } from "@tanstack/react-query"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
process.env.STRIPE_SECRET_KEY = ""
process.env.LOCATION_API_KEY = ""
timeoutManager.setTimeoutProvider({
  setTimeout: (callback, delay) => setTimeout(callback, delay).unref(),
  clearTimeout: (id) => clearTimeout(id),
  setInterval: (callback, delay) => setInterval(callback, delay).unref(),
  clearInterval: (id) => clearInterval(id),
})

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({
  configFile: false, cacheDir: "node_modules/.vite-tests/root-state", appType: "custom",
  resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/components": `${appPath}/components/ui`, "@coss/ui/lib": `${appPath}/lib` } },
  plugins: [{ name: "root-state-fixtures", transform(_code, id) {
    if (id === `${appPath}/lib/trpc/server.ts`) return `
      let query = async () => { throw new Error("Unexpected app context query") }
      export function setQuery(value) { query = value }
      export async function createTRPC() {
        return { profile: { getAppContext: { queryOptions: () => ({ queryKey: ["workspace-state"], queryFn: () => query() }) } }, onboarding: { status: { queryOptions: () => ({ queryKey: ["setup"], queryFn: async () => ({ setupComplete: true, billingEnabled: false }) }) } } }
      }
    `
    if (id === `${appPath}/middleware/i18next.ts`) return `
      export const i18nextMiddleware = async () => {}
      export const getLocale = () => "en"
      export const getInstance = () => ({ changeLanguage: async () => {} })
    `
    if (id === `${appPath}/lib/locale.server.ts`) return `
      export const synced = []
      export async function syncUserLocale(input) { synced.push(input) }
    `
  } }],
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})

try {
  const { profileRouter } = await vite.ssrLoadModule("/app/.server/routers/profile.ts") as typeof import("../app/.server/routers/profile")
  const { createTRPCRouter } = await vite.ssrLoadModule("/app/.server/trpc.ts") as typeof import("../app/.server/trpc")
  const router = createTRPCRouter(profileRouter)
  type Context = Parameters<typeof router.createCaller>[0]
  let organizationId: string | null = "business"
  let settingsReads = 0
  const memberships = [{ role: "member", organization: { id: "business", name: "Business" } }]
  function caller(signedIn = true) {
    return router.createCaller({
      user: signedIn ? { id: "user", locale: "fi" } : null, organizationId,
      prisma: {
        member: { findMany: async ({ where }: { where: { userId: string } }) => {
          assert.equal(where.userId, "user")
          return memberships
        } },
        organizationSettings: { findUnique: async ({ where }: { where: { organizationId: string } }) => {
          assert.equal(where.organizationId, "business")
          settingsReads += 1
          return { timezone: "Europe/Stockholm" }
        } },
      },
    } as unknown as Context)
  }
  assert.deepEqual(await caller().getAppContext(), {
    organizations: [{ id: "business", name: "Business", role: "member" }],
    organizationTimezone: "Europe/Stockholm", billingNotification: null,
  })
  organizationId = "other-business"
  assert.equal((await caller().getAppContext()).organizationTimezone, "Europe/Helsinki")
  assert.equal(settingsReads, 1, "An unrelated active organization cannot expose its settings")
  organizationId = null
  assert.equal((await caller().getAppContext()).organizations.length, 1, "Users without an active organization can still choose one")
  await assert.rejects(caller(false).getAppContext(), { code: "UNAUTHORIZED" })

  const { loader, links } = await vite.ssrLoadModule("/app/root.tsx") as typeof import("../app/root")
  const { setQuery } = await vite.ssrLoadModule("/app/lib/trpc/server.ts") as { setQuery: (query: () => Promise<unknown>) => void }
  const { synced } = await vite.ssrLoadModule("/app/lib/localization/locale.server.ts") as { synced: unknown[] }
  const { userContext, organizationContext, membershipContext } = await vite.ssrLoadModule("/app/middleware/auth.ts") as typeof import("../app/middleware/auth")
  const { formatPreferenceCookie, themeCookie, localeCookie } = await vite.ssrLoadModule("/app/lib/http/cookies.server.ts") as typeof import("../app/lib/http/cookies.server.ts")
  let user: { id: string; locale: string | null } | null = null
  let queryCalls = 0
  setQuery(async () => { queryCalls += 1; return caller().getAppContext() })
  async function load(cookie = "", userAgent = "") {
    return loader({
      request: new Request("https://example.invalid/book/test", { headers: { Cookie: cookie, "User-Agent": userAgent } }),
      context: { get: (key: unknown) => key === userContext ? user : key === organizationContext ? null : key === membershipContext ? null : undefined },
    } as unknown as Parameters<typeof loader>[0])
  }
  const guest = await load()
  assert.equal(queryCalls, 0, "Public pages do not fetch signed-in account data")
  assert.equal("organizations" in guest.data, false)
  assert.equal(guest.data.locale, "en")
  assert.equal(guest.data.theme, "light")
  assert.equal(guest.data.isReactNativeWebView, false)
  assert.equal("billingEnabled" in guest.data, false)
  assert.equal("hasActiveSubscription" in guest.data, false, "Unused subscription state is not queried or returned")
  const preferenceCookie = [await formatPreferenceCookie.serialize("us"), await themeCookie.serialize("dark")].map((value) => value.split(";")[0]).join("; ")
  user = { id: "user", locale: "fi" }
  const account = await load(preferenceCookie, "Electron/40.0.0")
  assert.equal(queryCalls, 0, "Signed-in visitors do not load workspace data on public pages")
  assert.equal(account.data.locale, "fi")
  assert.equal(account.data.formatPreference, "us")
  assert.equal(account.data.theme, "dark")
  assert.equal(account.data.isElectron, true)
  assert.equal(account.data.isReactNativeWebView, false)
  const native = await load(preferenceCookie, "Mozilla/5.0 ReactNativeWebView/1.0")
  assert.equal(native.data.isReactNativeWebView, true)
  assert.equal(native.data.isElectron, false)
  assert.equal("org" in account.data, false)
  assert.equal("organizations" in account.data, false)
  const { loader: workspaceLoader } = await vite.ssrLoadModule("/app/routes/layout.tsx") as typeof import("../app/routes/layout")
  organizationId = "business"
  const workspace = await workspaceLoader({
    context: { get: (key: unknown) => key === organizationContext ? { id: "business" } : key === membershipContext ? { staffProfile: { id: "staff" } } : undefined },
  } as unknown as Parameters<typeof workspaceLoader>[0])
  assert.equal(queryCalls, 1, "Workspace data loads in the authenticated layout")
  assert.equal(workspace.organizations[0].id, "business")
  assert.equal(workspace.organizationTimezone, "Europe/Stockholm")
  assert.equal(workspace.org?.id, "business")
  assert.equal(workspace.staffProfile?.id, "staff")
  assert.equal(workspace.billingEnabled, false)
  const headers = new Headers(account.init?.headers)
  const cookies = headers.getSetCookie()
  assert.equal(cookies.length, 3, "Locale, format and theme cookies are preserved")
  assert.equal(await localeCookie.parse(cookies.find((cookie) => cookie.startsWith("lng=")) ?? null), "fi")
  user = { id: "user", locale: null }
  await load()
  assert.deepEqual(synced, [{ userId: "user", locale: "en" }], "Accounts without a saved language keep their first-visit language initialization")
  assert.ok(links().some((link) => "rel" in link && link.rel === "manifest"))
  console.info("PASS root account state, organization isolation, guest defaults, preferences, Electron, cookies and locale initialization")
} finally {
  await vite.close()
}
