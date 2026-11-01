import "dotenv/config"
import assert from "node:assert/strict"
import { RouterContextProvider } from "react-router"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/auth-routing",
  appType: "custom",
  resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/components": `${appPath}/components/ui`, "@coss/ui/lib": `${appPath}/lib` } },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
})

try {
  const { auth } = await vite.ssrLoadModule("/app/lib/auth/server.ts") as typeof import("../app/lib/auth/server")
  const { loader } = await vite.ssrLoadModule("/app/routes/auth.tsx") as typeof import("../app/routes/auth")
  const { getSafeRedirectTo, getAfterOnboardingRedirect } = await vite.ssrLoadModule("/app/lib/auth/redirect.ts") as typeof import("../app/lib/auth/redirect")
  const { createAuthFormSchemas } = await vite.ssrLoadModule("/app/lib/schemas/auth.ts") as typeof import("../app/lib/schemas/auth")
  const { requireOrganizationMiddleware } = await vite.ssrLoadModule("/app/middleware/auth.ts") as typeof import("../app/middleware/auth")
  const originalSession = auth.api.getSession
  const load = (search: string) => loader({
    request: new Request(`http://localhost/auth?${search}`),
    url: new URL(`http://localhost/auth?${search}`),
    params: {}, context: new RouterContextProvider(), pattern: "/auth",
  })
  try {
    auth.api.getSession = (async () => ({ user: { id: "jupiter-auth-routing-user" }, session: { id: "auth-routing-session" } })) as typeof auth.api.getSession
    for (const target of ["/auth", "/auth/", "/AUTH", "/auth.data", "/%61uth", "//example.invalid", "/\\example.invalid"]) {
      assert.equal(getSafeRedirectTo(new URLSearchParams({ redirectTo: target })), "/")
    }
    for (const [search, destination] of [
      ["redirectTo=%2Fcustomers%2Fcustomer-one", "/customers/customer-one"],
      ["redirectTo=%2Fauth", "/"],
      ["invite=invite-one", "/invite/invite-one"],
      ["redirectTo=%2Finvite%2Finvite-one.data%3F_routes%3Droot", "/invite/invite-one"],
    ]) {
      await assert.rejects(() => load(search), (error: unknown) => error instanceof Response && error.status === 302 && error.headers.get("Location") === destination)
    }
    auth.api.getSession = (async () => null) as typeof auth.api.getSession
    assert.deepEqual(await load(""), { invitation: null })
    assert.equal(getAfterOnboardingRedirect(new URLSearchParams({ redirectTo: "/customers/customer-one?tab=test" }), true), "/customers/customer-one?tab=test&welcome=true")
    assert.equal(getAfterOnboardingRedirect(new URLSearchParams({ redirectTo: "/onboarding/business" })), "/")
    assert.equal(getAfterOnboardingRedirect(new URLSearchParams(), true), "/?welcome=true")
    await assert.rejects(async () => requireOrganizationMiddleware({
      request: new Request("http://localhost/customers/customer-one"),
      url: new URL("http://localhost/customers/customer-one"),
      params: {}, context: new RouterContextProvider(), pattern: "/customers/:id",
    } as Parameters<typeof requireOrganizationMiddleware>[0], async () => new Response()),
    (error: unknown) => error instanceof Response && error.headers.get("Location") === "/onboarding?redirectTo=%2Fcustomers%2Fcustomer-one")
    const schema = createAuthFormSchemas((key) => key)
    for (const otp of ["", "12345", "1234567", "abcdef"]) {
      assert.equal(schema.signIn.safeParse({ email: "test@example.invalid", otp }).success, false)
    }
    assert.equal(schema.signIn.safeParse({ email: "test@example.invalid", otp: "123456" }).success, true)
    console.info("PASS login deep links, invitation redirects, self-redirect rejection, signed-out access, and exact six-digit OTP validation")
  } finally {
    auth.api.getSession = originalSession
  }
} finally {
  await vite.close()
}
