import assert from "node:assert/strict"
import { applyServiceOrder, createServiceOrderQueue } from "../app/lib/services/service-order.ts"

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

const gate = deferred()
const writes: string[][] = []
let saved = ["a", "b", "c"]
let idle = 0
let errors = 0
const queue = createServiceOrderQueue({
  getIds: () => saved,
  save: async (ids) => {
    writes.push(ids)
    if (writes.length === 1) await gate.promise
    saved = ids
  },
  refresh: async () => {},
  onIdle: () => { idle++ },
  onError: () => { errors++ },
})
const first = queue.enqueue(["b", "a", "c"])
const second = queue.enqueue(["c", "b", "a"])
const third = queue.enqueue(["a", "c", "b"])
assert.deepEqual(writes, [["b", "a", "c"]])
gate.resolve()
await Promise.all([first, second, third])
assert.deepEqual(writes, [["b", "a", "c"], ["a", "c", "b"]])
assert.deepEqual(saved, ["a", "c", "b"])
assert.equal(idle, 1)
assert.equal(errors, 0)

const refreshing = deferred()
let refreshes = 0
const duringRefresh: string[][] = []
const refreshQueue = createServiceOrderQueue({
  getIds: () => ["a", "b", "c"],
  save: async (ids) => { duringRefresh.push(ids) },
  refresh: async () => { if (++refreshes === 1) await refreshing.promise },
  onIdle: () => {},
  onError: () => assert.fail("Unexpected save error"),
})
const refreshSave = refreshQueue.enqueue(["b", "a", "c"])
await Promise.resolve()
refreshQueue.enqueue(["c", "a", "b"])
refreshing.resolve()
await refreshSave
assert.deepEqual(duringRefresh, [["b", "a", "c"], ["c", "a", "b"]])
assert.equal(refreshes, 2)

let current = ["a", "b", "c"]
const rebased: string[][] = []
const conflictQueue = createServiceOrderQueue({
  getIds: () => current,
  save: async (ids) => {
    rebased.push(ids)
    if (rebased.length === 1) throw { data: { code: "CONFLICT" } }
  },
  refresh: async () => { current = ["a", "c", "d"] },
  onIdle: () => {},
  onError: () => assert.fail("A changed service list should be reconciled"),
})
await conflictQueue.enqueue(["c", "b", "a"])
assert.deepEqual(rebased, [["c", "b", "a"], ["c", "a", "d"]])
assert.deepEqual(applyServiceOrder([{ id: "a", name: "Edited name" }, { id: "c", name: "C" }, { id: "d", name: "New service" }], ["c", "b", "a"]), [{ id: "c", name: "C" }, { id: "a", name: "Edited name" }, { id: "d", name: "New service" }])

const failed = deferred()
const afterFailure: string[][] = []
let failures = 0
const failureQueue = createServiceOrderQueue({
  getIds: () => ["a", "b", "c"],
  save: async (ids) => {
    afterFailure.push(ids)
    if (afterFailure.length === 1) { await failed.promise; throw new Error("Network error") }
  },
  refresh: async () => {},
  onIdle: () => {},
  onError: () => { failures++ },
})
const failingSave = failureQueue.enqueue(["b", "a", "c"])
failureQueue.enqueue(["c", "a", "b"])
failed.resolve()
await failingSave
assert.deepEqual(afterFailure, [["b", "a", "c"], ["c", "a", "b"]])
assert.equal(failures, 1)
console.info("PASS rapid service order saves, latest pending order, edits during refresh, membership conflicts, fresh details and recovery after an older save fails")
