import assert from "node:assert/strict"
import { createServer } from "vite"

process.env.NODE_ENV = "production"
process.env.BETTER_AUTH_SECRET = "production-auth-regression-test-secret-123456789"
process.env.STRIPE_SECRET_KEY = ""

const appPath = new URL("../app", import.meta.url).pathname

for (const origin of ["http://localhost:3000", "http://192.168.100.34:3000", "https://jupiter.example.com"]) {
  process.env.BETTER_AUTH_URL = origin
  const secure = origin.startsWith("https:")
  const vite = await createServer({
    configFile: false,
    cacheDir: "node_modules/.vite-tests/auth-production",
    appType: "custom",
    resolve: { alias: { "~": appPath } },
    plugins: [{
      name: "auth-memory-database",
      transform(code, id) {
        if (id === `${appPath}/lib/database/prisma.server.ts`) {
          return "export const prisma = {}"
        }
        if (id === `${appPath}/lib/auth/server.ts`) {
          return code.replace(
            'import { prismaAdapter } from "better-auth/adapters/prisma"',
            'import { memoryAdapter } from "better-auth/adapters/memory"\nconst prismaAdapter = () => memoryAdapter({ user: [], session: [], verification: [], account: [] })',
          )
        }
      },
    }],
    server: { middlewareMode: true, ws: false, hmr: false, watch: null },
  })

  try {
    const { auth } = await vite.ssrLoadModule("/app/lib/auth/server.ts") as typeof import("../app/lib/auth/server")
    const email = "production-auth@example.invalid"
    const headers = new Headers({ origin, host: new URL(origin).host })
    const otp = await auth.api.createVerificationOTP({ headers, body: { email, type: "sign-in" } })
    const signedIn = await auth.handler(new Request(`${origin}/api/auth/sign-in/email-otp`, {
      method: "POST",
      headers: { ...Object.fromEntries(headers), "content-type": "application/json" },
      body: JSON.stringify({ email, otp }),
    }))
    assert.equal(signedIn.status, 200)
    const cookies = signedIn.headers.getSetCookie()
    const sessionCookie = cookies.find((cookie) => cookie.includes(".session_token="))
    assert.ok(sessionCookie)
    assert.equal(/; secure(?:;|$)/i.test(sessionCookie), secure, `${origin} must use cookies matching its protocol`)
    assert.equal(sessionCookie.startsWith("__Secure-"), secure)
    assert.match(sessionCookie, /; HttpOnly/i)
    assert.match(sessionCookie, /; SameSite=Lax/i)

    // Model a browser dropping Secure cookies on an ordinary HTTP host.
    headers.set("cookie", cookies
      .filter((cookie) => secure || !/; secure(?:;|$)/i.test(cookie))
      .map((cookie) => cookie.split(";")[0])
      .join("; "))
    const session = await auth.api.getSession({ headers })
    assert.equal(session?.user.email, email, "The next server-side request must retain the OTP session")
    const response = await auth.handler(new Request(`${origin}/api/auth/get-session`, { headers }))
    const body = await response.json() as { user?: { email: string } } | null
    assert.equal(body?.user?.email, email, "The client session endpoint must retain the OTP session")
    console.info(`PASS production OTP session over ${origin}`)
  } finally {
    await vite.close()
  }
}
