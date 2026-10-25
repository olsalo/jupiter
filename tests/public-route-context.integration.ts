import assert from "node:assert/strict"
import { RouterContextProvider } from "react-router"
import { createServer } from "vite"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/public-route-context",
  appType: "custom",
  resolve: { alias: { "~": appPath } },
  plugins: [{
    name: "public-context-fixtures",
    transform(_code, id) {
      if (id === `${appPath}/lib/auth/server.ts`) return `
        export let currentSession = { user: { id: "user", locale: "en" }, session: { id: "session", activeOrganizationId: "old-business" } }
        export const auth = { api: { getSession: async () => currentSession } }
        export function resetSession() { currentSession.session.activeOrganizationId = "old-business" }
      `
      if (id === `${appPath}/lib/prisma.server.ts`) return `
        export const calls = { organizations: 0, memberships: 0, updates: 0 }
        export const prisma = {
          organization: { findFirst: async ({ where }) => {
            calls.organizations += 1
            return where.id ? null : { id: "business", name: "Business" }
          } },
          member: { findFirst: async () => { calls.memberships += 1; return { role: "owner", staffProfile: null } } },
          session: { update: async () => { calls.updates += 1 } },
        }
        export function resetCalls() { for (const key of Object.keys(calls)) calls[key] = 0 }
      `
    },
  }],
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})

try {
  const { authMiddleware, organizationMiddleware, userContext, sessionContext, organizationContext, membershipContext } = await vite.ssrLoadModule("/app/middleware/auth.ts") as typeof import("../app/middleware/auth")
  const fixture = await vite.ssrLoadModule("/app/lib/database/prisma.server.ts") as { calls: { organizations: number; memberships: number; updates: number }; resetCalls: () => void }
  const sessionFixture = await vite.ssrLoadModule("/app/lib/auth/server.ts") as { resetSession: () => void }
  const { createTRPCContext, createTRPCRouter, publicProcedure, protectedProcedure, organizationProcedure } = await vite.ssrLoadModule("/app/.server/trpc.ts") as typeof import("../app/.server/trpc")
  const context = new RouterContextProvider()
  await authMiddleware({ request: new Request("https://example.invalid/book/other-business"), context } as unknown as Parameters<typeof authMiddleware>[0], async () => new Response())
  assert.equal(context.get(userContext)?.id, "user")
  assert.equal(context.get(organizationContext), null)
  assert.equal(context.get(membershipContext), null)
  assert.deepEqual(fixture.calls, { organizations: 0, memberships: 0, updates: 0 }, "Public route middleware reads only the session")

  const headers = new Headers({ cookie: "format=eu", "accept-language": "en" })
  const rpcContext = await createTRPCContext({ headers, authenticatedContext: { authSession: context.get(sessionContext), organizationId: null } })
  const router = createTRPCRouter({
    publicPage: publicProcedure.query(() => "public"),
    account: protectedProcedure.query(({ ctx }) => ctx.organizationId),
    workspace: organizationProcedure.query(({ ctx }) => ctx.organizationId),
  })
  const caller = router.createCaller(rpcContext)
  assert.equal(await caller.publicPage(), "public")
  assert.deepEqual(fixture.calls, { organizations: 0, memberships: 0, updates: 0 }, "Public API calls do not resolve or update the visitor's workspace")
  assert.equal(await caller.account(), "business")
  assert.equal(await caller.workspace(), "business")
  assert.deepEqual(fixture.calls, { organizations: 2, memberships: 1, updates: 1 }, "Protected API calls share fallback resolution and still check membership")
  assert.equal(context.get(sessionContext)?.session.activeOrganizationId, "business")

  fixture.resetCalls()
  sessionFixture.resetSession()
  await organizationMiddleware({ context } as unknown as Parameters<typeof organizationMiddleware>[0], async () => new Response())
  assert.equal(context.get(organizationContext)?.id, "business")
  assert.equal(context.get(membershipContext)?.role, "owner")
  assert.deepEqual(fixture.calls, { organizations: 2, memberships: 1, updates: 1 }, "Workspace and onboarding middleware retain organization recovery and membership loading")
  console.info("PASS public session isolation, lazy protected organization lookup, fallback session repair and workspace membership")
} finally {
  await vite.close()
}
