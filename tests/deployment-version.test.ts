import assert from "node:assert/strict"
import { mock } from "node:test"
import { setImmediate } from "node:timers/promises"
import { claimDeploymentReload, watchDeploymentVersion } from "../app/lib/browser/deployment-version.ts"

const names = ["window", "document", "navigator", "fetch"] as const
const originals = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
const browser = new EventTarget()
const page = Object.assign(new EventTarget(), { visibilityState: "visible" })
const network = { onLine: true }
const requests: RequestInit[] = []
const updates: string[] = []
let response = () => Promise.resolve(Response.json({ version: "current" }))
let stop = () => {}
const flush = async () => { await setImmediate() }
const show = () => {
  const event = new Event("pageshow")
  Object.defineProperty(event, "persisted", { value: true })
  browser.dispatchEvent(event)
}

try {
  mock.timers.enable({ apis: ["Date", "setTimeout", "setInterval"], now: 100_000 })
  for (const [name, value] of Object.entries({ window: browser, document: page, navigator: network, fetch: async (url: string, options: RequestInit) => {
    assert.equal(url, "/api/version")
    requests.push(options)
    return response()
  } })) Object.defineProperty(globalThis, name, { configurable: true, value })

  stop = watchDeploymentVersion("current", (version) => updates.push(version))
  await flush()
  assert.equal(requests.length, 1, "Startup checks the deployed version")
  assert.equal(requests[0].cache, "no-store")
  assert.equal(requests[0].credentials, "omit")
  assert.deepEqual(updates, [], "The current deployment does not reload")
  page.dispatchEvent(new Event("visibilitychange"))
  await flush()
  assert.equal(requests.length, 1, "Resume events share a cooldown")

  response = () => Promise.resolve(Response.json({ version: "next" }))
  mock.timers.tick(30_000)
  page.dispatchEvent(new Event("visibilitychange"))
  await flush()
  assert.deepEqual(updates, ["next"], "Resuming detects a deployment change")
  show()
  await flush()
  assert.equal(updates.length, 2, "A restored page checks even within the cooldown")

  page.visibilityState = "hidden"
  const beforeHidden = requests.length
  show()
  await flush()
  assert.equal(requests.length, beforeHidden, "Hidden pages do not check")
  page.visibilityState = "visible"
  network.onLine = false
  show()
  await flush()
  assert.equal(requests.length, beforeHidden, "Offline pages do not check")
  network.onLine = true
  browser.dispatchEvent(new Event("online"))
  await flush()
  assert.equal(requests.length, beforeHidden + 1, "Reconnecting retries immediately")

  for (const result of [new Response("Unavailable", { status: 503 }), Response.json({ version: "" }), Response.json({ version: 4 }), new Response("Not JSON")]) {
    response = () => Promise.resolve(result)
    const before: number = updates.length
    show()
    await flush()
    assert.equal(updates.length, before, "Invalid responses never request a reload")
  }
  response = () => Promise.reject(new TypeError("Offline"))
  show()
  await flush()

  let resolve!: (value: Response) => void
  response = () => new Promise((done) => { resolve = done })
  show()
  const duringRequest = requests.length
  browser.dispatchEvent(new Event("online"))
  assert.equal(requests.length, duringRequest, "Simultaneous events share one request")
  const beforeDispose = updates.length
  const signal = requests.at(-1)?.signal
  stop()
  assert.equal(signal?.aborted, true, "Unmounting aborts an in-flight check")
  resolve(Response.json({ version: "late" }))
  await flush()
  assert.equal(updates.length, beforeDispose, "Late responses cannot update an unmounted page")
  show()
  assert.equal(requests.length, duringRequest, "Unmounting removes browser listeners")

  response = () => new Promise(() => {})
  stop = watchDeploymentVersion("current", () => {})
  const timedSignal = requests.at(-1)?.signal
  mock.timers.tick(10_000)
  assert.equal(timedSignal?.aborted, true, "Unresponsive checks time out")
  stop()

  const idleUpdates: boolean[] = []
  response = () => Promise.resolve(Response.json({ version: "current" }))
  stop = watchDeploymentVersion("current", (_version, idle) => idleUpdates.push(idle))
  await flush()
  response = () => Promise.resolve(Response.json({ version: "next" }))
  mock.timers.tick(59_000)
  browser.dispatchEvent(new Event("pointermove"))
  mock.timers.tick(1_000)
  await flush()
  assert.deepEqual(idleUpdates, [false], "Periodic checks detect updates without reloading an active page")
  mock.timers.tick(60_000)
  await flush()
  assert.deepEqual(idleUpdates, [false, true], "A known update can reload after a minute without activity")
  browser.dispatchEvent(new Event("keydown"))
  show()
  await flush()
  assert.equal(idleUpdates.at(-1), false, "Keyboard activity resets idle detection")
  page.visibilityState = "hidden"
  const beforeHiddenPoll: number = requests.length
  mock.timers.tick(60_000)
  await flush()
  assert.equal(requests.length, beforeHiddenPoll, "Periodic checks skip hidden pages")
  page.visibilityState = "visible"
  network.onLine = false
  mock.timers.tick(60_000)
  await flush()
  assert.equal(requests.length, beforeHiddenPoll, "Periodic checks skip offline pages")
  network.onLine = true
  stop()
  mock.timers.tick(60_000)
  await flush()
  assert.equal(requests.length, beforeHiddenPoll, "Unmounting clears the polling timer")

  const saved = new Map<string, string>()
  const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value) } }
  assert.equal(claimDeploymentReload(storage, 100_000), true)
  assert.equal(claimDeploymentReload(storage, 100_001), false, "A stale server cannot trigger a reload loop")
  assert.equal(claimDeploymentReload(storage, 160_000), true)
  assert.equal(claimDeploymentReload({ getItem: () => { throw new Error("Blocked") }, setItem: () => {} }), false, "Blocked storage falls back to a manual update")
  console.info("PASS deployment checks, resume events, offline recovery, request cleanup and reload loop protection")
} finally {
  stop()
  mock.timers.reset()
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
}
