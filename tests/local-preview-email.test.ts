import assert from "node:assert/strict"
import { createServer } from "vite"

process.env.NODE_ENV = "production"
process.env.EMAIL_PROVIDER = "unexpected-provider"
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/local-preview-email",
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})
const originalInfo = console.info
const messages: string[] = []
console.info = (message: string) => { messages.push(message) }

try {
  const { sendOtpEmail } = await vite.ssrLoadModule("/app/lib/email/email.server.ts") as typeof import("../app/lib/email/email.server")
  const options = { email: "preview@example.invalid", locale: "en", otp: "123456", type: "sign-in" } as const
  process.env.LOCAL_PREVIEW_EMAIL = "console"
  process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000"
  await sendOtpEmail(options)
  assert.deepEqual(messages, ["[better-auth:local-preview] sign-in OTP for preview@example.invalid: 123456"])

  messages.length = 0
  for (const origin of ["https://app.example.com", "http://127.0.0.1.example.com:3000", "https://127.0.0.1:3000"]) {
    process.env.BETTER_AUTH_URL = origin
    await assert.rejects(sendOtpEmail(options), /Unsupported EMAIL_PROVIDER/)
  }
  process.env.BETTER_AUTH_URL = "http://127.0.0.1:3000"
  delete process.env.LOCAL_PREVIEW_EMAIL
  await assert.rejects(sendOtpEmail(options), /Unsupported EMAIL_PROVIDER/)
  assert.deepEqual(messages, [], "Normal production email must never log OTPs")
} finally {
  console.info = originalInfo
  await vite.close()
}
console.info("PASS local preview logs OTPs without email delivery, while normal production keeps email validation")
