import assert from "node:assert/strict"
import { RouterContextProvider } from "react-router"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
process.env.BETTER_AUTH_URL = "http://localhost:5175"
process.env.BETTER_AUTH_SECRET = "session-refresh-regression-test-secret-123456789"
process.env.STRIPE_SECRET_KEY = ""

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/auth-session-refresh",
  appType: "custom",
  resolve: { alias: { "~": appPath } },
  plugins: [{
    name: "auth-memory-database",
    transform(code, id) {
      if (id === `${appPath}/lib/database/prisma.server.ts`) return "export const prisma = {}"
      if (id === `${appPath}/lib/auth/server.ts`) return code.replace(
        'import { prismaAdapter } from "better-auth/adapters/prisma"',
        'import { memoryAdapter } from "better-auth/adapters/memory"\nconst prismaAdapter = () => memoryAdapter({ user: [], session: [], verification: [], account: [] })',
      )
    },
  }],
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})

try {
  const { auth } = await vite.ssrLoadModule("/app/lib/auth/server.ts") as typeof import("../app/lib/auth/server")
  const { authMiddleware, sessionContext } = await vite.ssrLoadModule("/app/middleware/auth.ts") as typeof import("../app/middleware/auth")
  const email = "session.refresh@example.com"
  const headers = new Headers({ origin: "http://localhost:5175" })
  const otp = await auth.api.createVerificationOTP({ headers, body: { email, type: "sign-in" } })
  const signedIn = await auth.handler(new Request("http://localhost:5175/api/auth/sign-in/email-otp", {
    method: "POST", headers: { origin: "http://localhost:5175", "content-type": "application/json" },
    body: JSON.stringify({ email, otp }),
  }))
  assert.equal(signedIn.status, 200)
  const cookie = signedIn.headers.getSetCookie().find((value) => value.includes(".session_token="))!
  assert.ok(cookie)
  headers.set("cookie", cookie.split(";")[0])
  const session = await auth.api.getSession({ headers })
  assert.ok(session)
  const authContext = await auth.$context
  const year = 365 * 24 * 60 * 60 * 1000
  const ageSession = () => authContext.internalAdapter.updateSession(session.session.token, {
    expiresAt: new Date(Date.now() + year - 2 * 24 * 60 * 60 * 1000),
  })
  const run = async (response = new Response("OK")) => {
    const context = new RouterContextProvider()
    const result = await authMiddleware({
      request: new Request("http://localhost:5175/calendar", { headers }),
      url: new URL("http://localhost:5175/calendar"), params: {}, context, pattern: "/calendar",
    }, async () => response)
    assert.ok(result instanceof Response)
    return { response: result, session: context.get(sessionContext) }
  }
  await ageSession()
  const before = Date.now()
  const refreshed = await run()
  assert.ok(refreshed.session)
  assert.ok(refreshed.session.session.expiresAt.getTime() >= before + year - 1000)
  assert.match(refreshed.response.headers.get("set-cookie") ?? "", /Max-Age=31536000/i)
  const stored = await auth.api.getSession({ headers })
  assert.equal(stored?.session.expiresAt.getTime(), refreshed.session.session.expiresAt.getTime())
  assert.equal((await run()).response.headers.getSetCookie().length, 0, "Do not refresh again within a day")

  await ageSession()
  const deletedCookie = `${cookie.split("=", 1)[0]}=; Max-Age=0; Path=/`
  const signOut = await run(new Response(null, { headers: { "Set-Cookie": deletedCookie } }))
  assert.deepEqual(signOut.response.headers.getSetCookie(), [deletedCookie], "Do not override downstream sign-out cookies")
  console.info("PASS rolling one-year expiry, renewed browser cookie, daily refresh interval, and downstream cookie precedence")
} finally {
  await vite.close()
}
