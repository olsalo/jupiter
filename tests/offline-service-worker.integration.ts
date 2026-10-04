import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { runInNewContext } from "node:vm"
import { transformWithOxc } from "vite"

const workerPath = new URL("../app/service-worker.ts", import.meta.url)
const { code } = await transformWithOxc(await readFile(workerPath, "utf8"), workerPath.pathname, { lang: "ts" })
const { createOfflineDocument } = await import(new URL("../app/lib/offline-document.ts", import.meta.url).href) as typeof import("../app/lib/offline-document")
const document = createOfflineDocument("en")
const finnishDocument = createOfflineDocument("fi")
assert.match(finnishDocument, /<html lang="fi">/)
assert.notEqual(finnishDocument, document)
assert.match(document, /<meta http-equiv="refresh" content="5"\s*\/>/)

// Run the compiled worker with browser globals to exercise its actual event handlers.
type WorkerEvent = {
  data?: { type: string, locale: string }
  request?: { method: string, mode: string, url: string }
  waitUntil?: (promise: Promise<unknown>) => void
  respondWith?: (promise: Promise<Response>) => void
}
const listeners = new Map<string, (event: WorkerEvent) => void>()
const cachedResponse = new Response(document, { headers: { "Content-Type": "text/html" } })
const deletedCaches: string[] = []
const cachedPaths: string[] = []
const stored = new Map<string, Response>()
const finnishResponse = new Response(finnishDocument)
let claimed = false
let activated = false
let offline = false
let networkOptions: RequestInit | undefined
let cachedPages = 0
const onlineResponse = new Response("App page")

runInNewContext(code.replace(/export\s*\{\s*\};?/g, ""), {
  Request: class extends Request {
    constructor(path: string, options?: RequestInit) {
      super(new URL(path, "https://example.test"), options)
    }
  },
  Response,
  addEventListener: (name: string, listener: (event: WorkerEvent) => void) => listeners.set(name, listener),
  caches: {
    open: async () => ({
      add: async (request: Request) => {
        const path = new URL(request.url).pathname
        cachedPaths.push(path)
        stored.set(path, path === "/offline-fi.html" ? finnishResponse : cachedResponse)
      },
      put: async (key: string, response: Response) => { stored.set(key, response.clone()) },
      match: async (key: string) => {
        if (key !== "/__offline-locale") cachedPages += 1
        return stored.get(key)?.clone()
      },
    }),
    match: async () => undefined,
    keys: async () => ["jupiter-offline-v0", "jupiter-offline-v2", "other-app-cache"],
    delete: async (name: string) => { deletedCaches.push(name); return true },
  },
  clients: { claim: async () => { claimed = true } },
  skipWaiting: async () => { activated = true },
  fetch: async (_request: Request, options: RequestInit) => {
    networkOptions = options
    if (offline) throw new TypeError("Network unavailable")
    return onlineResponse
  },
})

for (const name of ["install", "activate"]) {
  let pending: Promise<unknown> | undefined
  listeners.get(name)?.({ waitUntil: (promise) => { pending = promise } })
  assert.ok(pending)
  await pending
}
assert.deepEqual(cachedPaths, ["/offline.html", "/offline-fi.html"])
assert.equal(activated, true)
assert.equal(claimed, true)
assert.deepEqual(deletedCaches, ["jupiter-offline-v0"])

function request(method: string, mode: string) {
  let response: Promise<Response> | undefined
  listeners.get("fetch")?.({
    request: { method, mode, url: "https://example.test/team" },
    respondWith: (promise) => { response = promise },
  })
  return response
}

assert.equal(await request("GET", "navigate"), onlineResponse)
assert.equal(networkOptions?.cache, "no-store")
assert.equal(cachedPages, 0)
offline = true
assert.equal(await (await request("GET", "navigate"))?.text(), document)
assert.equal(request("POST", "navigate"), undefined)
assert.equal(request("GET", "cors"), undefined)
async function setLocale(locale: string) {
  let pending: Promise<unknown> | undefined
  listeners.get("message")?.({
    data: { type: "SET_OFFLINE_LOCALE", locale },
    waitUntil: (promise) => { pending = promise },
  })
  await pending
}
await setLocale("fi")
assert.equal(await (await request("GET", "navigate"))?.text(), finnishDocument)
await setLocale("invalid")
assert.equal(await (await request("GET", "navigate"))?.text(), finnishDocument)
await setLocale("en")
assert.equal(await (await request("GET", "navigate"))?.text(), document)
offline = false
assert.equal(await request("GET", "navigate"), onlineResponse)
assert.equal(cachedPages, 4)
console.log("PASS offline install, cache cleanup, navigation fallback, saved language selection, recovery, uncached API/mutations, and five-second retry")
