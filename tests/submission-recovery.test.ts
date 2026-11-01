import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { TRPCClientError } from "@trpc/client"
import { transformWithOxc } from "vite"

const sourcePath = new URL("../app/lib/browser/submission-recovery.ts", import.meta.url)
const source = await readFile(sourcePath, "utf8")
const toastSource = (await readFile(new URL("../app/lib/toast.ts", import.meta.url), "utf8"))
  .replace('from "@base-ui/react/toast"', `from ${JSON.stringify(import.meta.resolve("@base-ui/react/toast"))}`)
  .replace('import { getSubmissionErrorToastRemovalHandler } from "~/lib/browser/submission-recovery"', "")
async function loadRecovery(production: boolean) {
  const { code } = await transformWithOxc(`${source}\n${toastSource}`, sourcePath.pathname, {
    lang: "ts",
    define: { "import.meta.env.PROD": String(production), "import.meta.env.DEV": String(!production) },
  })
  return await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`) as typeof import("../app/lib/browser/submission-recovery") & typeof import("../app/lib/toast")
}
const { fetchWithSubmissionRecovery, isUnexpectedSubmissionError, reloadAfterSubmissionError, toast, toastManager } = await loadRecovery(true)

const internalError = TRPCClientError.from({ error: {
  code: -32603,
  message: "Internal server error",
  data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
} })
assert.equal(isUnexpectedSubmissionError(internalError), true, "Structured server errors trigger recovery even in an HTTP 200 stream")
for (const status of [500, 502, 503, 504]) {
  assert.equal(isUnexpectedSubmissionError({ status }), true)
  assert.equal(isUnexpectedSubmissionError({ meta: { response: new Response(null, { status }) } }), true)
}
assert.equal(isUnexpectedSubmissionError(TRPCClientError.from(new SyntaxError("Unexpected token <"))), true, "An unreadable tRPC response triggers recovery")
const transformError = new Error("Unable to transform response")
transformError.name = "TransformResultError"
assert.equal(isUnexpectedSubmissionError(TRPCClientError.from(transformError)), true)

for (const status of [400, 401, 403, 404, 408, 409, 422, 429]) {
  assert.equal(isUnexpectedSubmissionError({ status }), false, `${status} remains an expected submission failure`)
}
for (const error of [undefined, null, new Error("Local bug"), new SyntaxError("Local parsing"), TRPCClientError.from(new TypeError("Failed to fetch")), TRPCClientError.from(new DOMException("Aborted", "AbortError")), { errors: { name: "Required" }, status: 500 }, { data: { httpStatus: 500, zodError: { fieldErrors: { email: ["Invalid"] } } } }]) {
  assert.equal(isUnexpectedSubmissionError(error), false, "Validation, network, cancellation and local errors keep their normal handling")
}

const names = ["window", "navigator", "fetch"] as const
const originals = new Map(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
let reloads = 0
let requests = 0
let response = new Response("Bad gateway", { status: 502 })
let offlineFailure = false
const network = { onLine: true }
try {
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { reload: () => { reloads += 1 } } } })
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: network })
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: async () => {
    requests += 1
    if (offlineFailure) throw new TypeError("Failed to fetch")
    return response
  } })
  const addedToasts: { type: string; onRemove?: () => void }[] = []
  toastManager[" subscribe"]((event) => {
    if (event.action === "add") addedToasts.push(event.options)
  })
  toast.error("Earlier error")
  assert.equal(addedToasts.at(-1)?.onRemove, undefined, "Earlier errors cannot trigger a later recovery")
  const development = await loadRecovery(false)
  development.reloadAfterSubmissionError(internalError)
  await development.fetchWithSubmissionRecovery("https://example.test/api/trpc", { method: "POST" })
  assert.equal(reloads, 0, "Development keeps normal error handling instead of forcing a reload")
  await fetchWithSubmissionRecovery("https://example.test/api/trpc", { method: "GET" })
  assert.equal(reloads, 0, "Query failures do not force a reload")
  response = new Response(null, { status: 422 })
  await fetchWithSubmissionRecovery("https://example.test/api/trpc", { method: "POST" })
  assert.equal(reloads, 0, "Validation responses do not force a reload")
  response = new Response(null, { status: 200 })
  await fetchWithSubmissionRecovery("https://example.test/api/trpc", { method: "POST" })
  assert.equal(reloads, 0, "Successful submissions do not reload")
  offlineFailure = true
  await assert.rejects(fetchWithSubmissionRecovery("https://example.test/api/trpc", { method: "POST" }), /Failed to fetch/)
  assert.equal(reloads, 0, "Failed connections do not reload")
  offlineFailure = false
  network.onLine = false
  reloadAfterSubmissionError(internalError)
  assert.equal(reloads, 0, "Offline recovery preserves the page")
  network.onLine = true
  response = new Response("Bad gateway", { status: 502 })
  const before: number = requests
  assert.equal(await fetchWithSubmissionRecovery(new Request("https://example.test/api/trpc", { method: "POST" })), response)
  assert.equal(reloads, 0, "A proxy HTML error waits for the error toast to disappear")
  assert.equal(requests, before + 1, "Recovery never retries a potentially saved submission")
  reloadAfterSubmissionError(internalError)
  assert.equal(reloads, 0, "The form and transport both wait for toast removal")
  toast.success("Saved")
  assert.equal(addedToasts.at(-1)?.onRemove, undefined, "Success toasts do not trigger recovery")
  toast.error("Something went wrong")
  const onRemove = addedToasts.at(-1)?.onRemove
  assert.equal(typeof onRemove, "function", "The error toast receives the pending recovery")
  toast.close()
  assert.equal(reloads, 0, "Starting the close animation does not reload")
  network.onLine = false
  onRemove?.()
  assert.equal(reloads, 0, "Going offline while the toast is visible preserves the page")
  network.onLine = true
  onRemove?.()
  assert.equal(reloads, 1, "The page reloads after the error toast has finished disappearing")
  onRemove?.()
  reloadAfterSubmissionError(internalError)
  toast.error("Another error")
  assert.equal(addedToasts.at(-1)?.onRemove, undefined)
  assert.equal(reloads, 1, "Repeated errors and removal callbacks cannot reload twice")
  console.info("PASS submission recovery for server and decoding failures, expected errors, offline requests and duplicate reload protection")
} finally {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
}
