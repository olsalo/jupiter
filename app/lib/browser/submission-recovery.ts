let reloading = false
let reloadPending = false

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function isUnexpectedSubmissionError(error: unknown) {
  if (!isRecord(error)) return false
  const data = isRecord(error.data) ? error.data : undefined
  const validation = isRecord(data?.zodError) ? data.zodError : undefined
  if (isRecord(error.errors) && Object.keys(error.errors).length > 0) return false
  if (isRecord(validation?.fieldErrors) && Object.keys(validation.fieldErrors).length > 0) return false

  const meta = isRecord(error.meta) ? error.meta : undefined
  const response = isRecord(meta?.response) ? meta.response : isRecord(error.response) ? error.response : undefined
  const status = data?.httpStatus ?? response?.status ?? error.status
  if (typeof status === "number" && status >= 500 && status <= 599) return true
  if (typeof status === "number" && status >= 400 && status < 500) return false
  if (data?.code === "INTERNAL_SERVER_ERROR") return true

  // A deployment can leave an old client unable to decode a successful tRPC response
  const cause = isRecord(error.cause) ? error.cause : undefined
  return error.name === "TRPCClientError" && (cause?.name === "SyntaxError" || cause?.name === "TransformResultError")
}

export function reloadAfterSubmissionError(error: unknown) {
  if (!import.meta.env.PROD) return
  if (typeof window === "undefined" || !navigator.onLine || reloading || !isUnexpectedSubmissionError(error)) return
  reloadPending = true
}

export function getSubmissionErrorToastRemovalHandler() {
  if (!reloadPending || reloading) return undefined

  return () => {
    if (typeof window === "undefined" || !navigator.onLine || reloading) return
    // Wait until the error toast has disappeared, and never retry the mutation
    reloading = true
    window.location.reload()
  }
}

export async function fetchWithSubmissionRecovery(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init)
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && response.status >= 500) {
    // Inspect the response before parsing, including HTML error pages from a proxy
    reloadAfterSubmissionError({ status: response.status })
  }
  return response
}
