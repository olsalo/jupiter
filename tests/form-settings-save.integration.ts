import assert from "node:assert/strict"

const { createFormSettingsSaveQueue } = await import(new URL("../app/lib/forms/form-settings-save-queue.ts", import.meta.url).href) as typeof import("../app/lib/forms/form-settings-save-queue")

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

const queue = createFormSettingsSaveQueue()
const firstStarted = deferred()
const firstResponse = deferred()
const lastStarted = deferred()
const lastResponse = deferred()
const requests: string[] = []
let savedColor = "original"
const first = queue.enqueue(async () => {
  requests.push("orange")
  firstStarted.resolve()
  await firstResponse.promise
  savedColor = "orange"
})
await firstStarted.promise
const second = queue.enqueue(async () => {
  requests.push("grape")
  savedColor = "grape"
})
assert.equal(queue.pendingCount, 2)
assert.deepEqual(requests, ["orange"], "A newer selection must wait for the older write")

let flushed = false
const flush = queue.flush().then(() => { flushed = true })
// Simulate reverting to the original value while a save/close is waiting.
const last = queue.enqueue(async () => {
  requests.push("original")
  lastStarted.resolve()
  await lastResponse.promise
  savedColor = "original"
})
firstResponse.resolve()
await lastStarted.promise
assert.equal(flushed, false, "Flushing must include selections made while earlier requests are in flight")
assert.deepEqual(requests, ["orange", "grape", "original"])
assert.equal(savedColor, "grape")
lastResponse.resolve()
await Promise.all([first, second, last, flush])
assert.equal(savedColor, "original", "The latest selection must win, including reverting to the original value")
assert.equal(queue.pendingCount, 0)
console.info("PASS rapid selections save in order, latest selection wins, and closing waits for newly queued saves")

const recoveryQueue = createFormSettingsSaveQueue()
const failed = recoveryQueue.enqueue(async () => { throw new Error("Temporary save failure") })
const failureCheck = assert.rejects(failed, /Temporary save failure/)
const recovered = recoveryQueue.enqueue(async () => { savedColor = "blueberry" })
await Promise.all([failureCheck, recovered, recoveryQueue.flush()])
assert.equal(savedColor, "blueberry", "A failed request must not block later selections")
assert.equal(recoveryQueue.pendingCount, 0)
console.info("PASS a failed save does not block newer changes or leave the queue stuck")
