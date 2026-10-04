import assert from "node:assert/strict"
import { QueryClient, QueryObserver } from "@tanstack/react-query"

const { queryCacheOptions } = await import(new URL("../app/lib/query-cache.ts", import.meta.url).href) as typeof import("../app/lib/query-cache")

const queryClient = new QueryClient({ defaultOptions: { queries: { ...queryCacheOptions, retry: false } } })
let requests = 0
let release!: () => void
const options = {
  queryKey: ["form", "settings"],
  queryFn: async () => {
    requests += 1
    await new Promise<void>((resolve) => { release = resolve })
    return { timeZone: "Europe/Helsinki" }
  },
}

const observer = new QueryObserver(queryClient, options)
const unsubscribe = observer.subscribe(() => {})
const showsLoading = () => {
  const state = observer.getCurrentResult()
  return state.isLoading
}

try {
  const opening = queryClient.query(options)
  const tab = queryClient.query(options)
  assert.equal(showsLoading(), true, "Missing cache must show loading")
  assert.equal(observer.getCurrentResult().isLoading, true, "Regular routes must show loading without cache")
  assert.equal(requests, 1, "Opening and navigating must share the same request")
  release()
  await Promise.all([opening, tab])

  await queryClient.query(options)
  assert.equal(showsLoading(), false, "Switching tabs with fresh cache must be immediate")
  assert.equal(requests, 1, "Fresh cache must not trigger another request")

  const invalidated = queryClient.invalidateQueries({ queryKey: options.queryKey })
  assert.equal(observer.getCurrentResult().isLoading, false, "Refreshing cached data is not an initial load")
  assert.equal(showsLoading(), false, "Invalidated cache must keep loaded content visible")
  release()
  await invalidated

  queryClient.setQueryData(options.queryKey, { timeZone: "Europe/Helsinki" }, { updatedAt: Date.now() - queryCacheOptions.staleTime - 1000 })
  const expired = queryClient.query(options)
  assert.equal(observer.getCurrentResult().isLoading, false, "Regular routes must keep stale cached data visible")
  assert.equal(showsLoading(), false, "Expired cache must keep loaded content visible")
  release()
  await expired
  assert.equal(requests, 3)

  // A tab switch mounts a new observer, with no component state from the last visit.
  queryClient.setQueryData(options.queryKey, { timeZone: "Europe/Helsinki" }, { updatedAt: Date.now() - queryCacheOptions.staleTime - 1000 })
  const revisitedTab = new QueryObserver(queryClient, options)
  const unsubscribeTab = revisitedTab.subscribe(() => {})
  try {
    assert.equal(revisitedTab.getCurrentResult().isFetching, true, "Revisiting a stale tab must still refresh its data")
    assert.equal(revisitedTab.getCurrentResult().isLoading, false, "Revisiting a stale tab must not replace cached content with a loader")
    assert.deepEqual(revisitedTab.getCurrentResult().data, { timeZone: "Europe/Helsinki" })
    const refreshing = queryClient.query(options)
    release()
    await refreshing
    assert.equal(requests, 4, "Tab revisit and query must share one refresh")
  } finally {
    unsubscribeTab()
  }
  console.info("PASS missing-data loading, shared requests, and visible cached content during stale tab revisits and refreshes")
} finally {
  unsubscribe()
  queryClient.clear()
}
