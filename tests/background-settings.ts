import assert from "node:assert/strict"

const { createBackgroundSetting } = await import(new URL("../app/lib/background-setting.ts", import.meta.url).href) as typeof import("../app/lib/background-setting")
const { createFormSettingsSaveQueue } = await import(new URL("../app/lib/forms/form-settings-save-queue.ts", import.meta.url).href) as typeof import("../app/lib/forms/form-settings-save-queue")

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

const queue = createFormSettingsSaveQueue()
const setting = createBackgroundSetting("en", queue)
const firstStarted = deferred()
const firstResponse = deferred()
const lastStarted = deferred()
const lastResponse = deferred()
const writes: string[] = []
let saved = "en"
let errors = 0
const onError = () => { errors += 1 }
const first = setting.set("fi", async () => {
  writes.push("fi")
  firstStarted.resolve()
  await firstResponse.promise
  saved = "fi"
}, onError)
await firstStarted.promise
const last = setting.set("en", async () => {
  writes.push("en")
  lastStarted.resolve()
  await lastResponse.promise
  saved = "en"
}, onError)
assert.deepEqual(setting.getSnapshot(), { value: "en", isSaving: true }, "The latest choice must appear immediately while writes are queued")
assert.deepEqual(writes, ["fi"], "Requests must be serialized")
firstResponse.resolve()
await lastStarted.promise
assert.deepEqual(setting.getSnapshot(), { value: "en", isSaving: true }, "An older response cannot overwrite the latest selection or hide the spinner")
lastResponse.resolve()
await Promise.all([first, last])
assert.equal(saved, "en")
assert.deepEqual(setting.getSnapshot(), { value: "en", isSaving: false })

const failingStarted = deferred()
const failingResponse = deferred()
const failed = setting.set("fi", async () => {
  failingStarted.resolve()
  await failingResponse.promise
  throw new Error("Failed")
}, onError)
await failingStarted.promise
const recovered = setting.set("en", async () => { saved = "en" }, onError)
failingResponse.resolve()
await Promise.all([failed, recovered])
assert.equal(setting.getSnapshot().value, "en", "A failed earlier save must not roll back a newer selection")
assert.equal(errors, 1)
await setting.set("fi", async () => { throw new Error("Failed again") }, onError)
assert.deepEqual(setting.getSnapshot(), { value: "en", isSaving: false }, "A failed final save rolls back to the last confirmed value")

const theme = createBackgroundSetting("light", queue)
const format = createBackgroundSetting("eu", queue)
const themeStarted = deferred()
const themeResponse = deferred()
let formatStarted = false
const themeSave = theme.set("dark", async () => {
  themeStarted.resolve()
  await themeResponse.promise
}, onError)
await themeStarted.promise
const formatSave = format.set("us", async () => { formatStarted = true }, onError)
assert.equal(format.getSnapshot().value, "us")
assert.equal(formatStarted, false, "Cookie writes and loader refreshes for different settings must also stay ordered")
themeResponse.resolve()
await Promise.all([themeSave, formatSave])
assert.equal(formatStarted, true)
console.info("PASS immediate selection, ordered rapid saves, pending spinner, cross-setting ordering, failure rollback, and recovery")
