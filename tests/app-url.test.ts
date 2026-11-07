import assert from "node:assert/strict"

import { getAppBaseUrl } from "../app/lib/routing/app-url.server.ts"

assert.equal(getAppBaseUrl(new URL("https://example.com/marketing"), "https://app.example.com"), "https://app.example.com")
assert.equal(getAppBaseUrl(new URL("https://app.example.com/marketing"), "https://app.example.com"), "")
assert.equal(getAppBaseUrl(new URL("http://localhost:5175/marketing"), ""), "")
assert.equal(getAppBaseUrl(new URL("http://localhost:5175/marketing"), "http://localhost:5175"), "")
for (const invalid of ["javascript:alert(1)", "https://example.com/path", "https://user:password@example.com", "https://example.com?query=1"]) {
  assert.throws(() => getAppBaseUrl(new URL("https://example.com/"), invalid))
}

console.info("PASS configured app links across domains, same-origin links and invalid URL rejection")
