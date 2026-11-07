import assert from "node:assert/strict"
import { createServer } from "vite"

const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/marketing-access",
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})
const originalFetch = globalThis.fetch
const originalEnv = { ...process.env }
const deliveries: Record<string, unknown>[] = []

try {
  process.env.NODE_ENV = "production"
  process.env.EMAIL_PROVIDER = "plunk"
  process.env.PLUNK_API_KEY = "test-key"
  process.env.EMAIL_FROM = "Jupiter <noreply@example.com>"
  delete process.env.EMAIL_OVERRIDE_TO
  globalThis.fetch = async (_url, options) => {
    deliveries.push(JSON.parse(String(options?.body)))
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  }
  const { sendMarketingAccessRequest } = await vite.ssrLoadModule("/app/.server/services/marketing-access.ts") as typeof import("../app/.server/services/marketing-access")

  delete process.env.MARKETING_ACCESS_REQUEST_TO
  await assert.rejects(sendMarketingAccessRequest({ email: "visitor@example.com" }), /MARKETING_ACCESS_REQUEST_TO/)
  process.env.MARKETING_ACCESS_REQUEST_TO = "owner@example.com"
  await assert.rejects(sendMarketingAccessRequest({ email: "" }))
  await assert.rejects(sendMarketingAccessRequest({ email: "invalid" }))
  assert.equal(deliveries.length, 0)

  await sendMarketingAccessRequest({ email: " visitor@example.com " })
  assert.equal(deliveries.length, 1)
  assert.equal(deliveries[0].to, "owner@example.com")
  assert.equal(deliveries[0].reply, "visitor@example.com")
  assert.equal(deliveries[0].subject, "New Jupiter access request")
  assert.match(String(deliveries[0].body), /visitor@example.com/)

  await sendMarketingAccessRequest({ email: "o'connor@example.com" })
  assert.match(String(deliveries[1].body), /o&#39;connor@example.com/)

  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, error: { message: "Delivery unavailable" } }), { status: 503 })
  await assert.rejects(sendMarketingAccessRequest({ email: "visitor@example.com" }), /Delivery unavailable/)
} finally {
  globalThis.fetch = originalFetch
  process.env = originalEnv
  await vite.close()
}

console.info("PASS marketing requests validate email and configuration, send to the server recipient, escape HTML and surface delivery errors")
