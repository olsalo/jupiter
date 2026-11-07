import assert from "node:assert/strict"
import { localPreviewHeaders } from "../scripts/lib/local-preview.ts"

const headers = localPreviewHeaders({
  host: "spoofed.example",
  forwarded: "for=198.51.100.1;proto=https",
  "x-forwarded-for": "198.51.100.1, 198.51.100.2",
  "x-real-ip": "198.51.100.3",
  "x-forwarded-host": "spoofed.example",
  "x-forwarded-proto": "https",
  cookie: "session=test",
  origin: "http://127.0.0.1:3000",
}, "http://127.0.0.1:3000", "127.0.0.1")

assert.equal(headers.host, "127.0.0.1:3000")
assert.equal(headers["x-forwarded-host"], "127.0.0.1:3000")
assert.equal(headers["x-forwarded-proto"], "http")
assert.equal(headers["x-forwarded-for"], "127.0.0.1")
assert.equal(headers["x-real-ip"], "127.0.0.1")
assert.equal(headers.forwarded, undefined)
assert.equal(headers.cookie, "session=test")
assert.equal(headers.origin, "http://127.0.0.1:3000")
console.info("PASS local preview replaces spoofed proxy headers and preserves authentication headers")
