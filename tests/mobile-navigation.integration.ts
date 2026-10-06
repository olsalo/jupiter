import assert from "node:assert/strict"
import { QueryClient, QueryObserver } from "@tanstack/react-query"
import { clearMobileNavigationQuery } from "../app/lib/mobile-navigation.ts"

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
let desktop = false
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { matchMedia: () => ({ matches: desktop }) },
})

const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } })

try {
  for (const pathname of ["/example", "/team"]) {
    const key = [pathname, "list"]
    const countKey = [pathname, "count"]
    client.setQueryData(key, ["cached"])
    client.setQueryData(countKey, 1)

    desktop = true
    clearMobileNavigationQuery(client, key, new Request(`https://example.test${pathname}`), pathname)
    assert.deepEqual(client.getQueryData(key), ["cached"], "Desktop keeps its fresh cache")

    desktop = false
    clearMobileNavigationQuery(client, key, new Request(`https://example.test${pathname}?search=test`), pathname)
    assert.equal(client.getQueryData(key), undefined)
    assert.equal(client.getQueryData(countKey), 1, "Mobile retains skeleton counts")

    let fetches = 0
    let finishFetch: (data: string[]) => void = () => {}
    const observer = new QueryObserver(client, {
      queryKey: key,
      queryFn: () => {
        fetches += 1
        return new Promise<string[]>((resolve) => { finishFetch = resolve })
      },
    })
    const unsubscribe = observer.subscribe(() => {})
    assert.equal(observer.getCurrentResult().isLoading, true, "Destination mounts with loading UI")
    assert.equal(observer.getCurrentResult().data, undefined)
    assert.equal(fetches, 1, "Even a fresh cached page fetches on mobile revisit")
    finishFetch(["fresh"])
    await client.getQueryCache().find({ queryKey: key })?.promise
    assert.deepEqual(client.getQueryData(key), ["fresh"])

    clearMobileNavigationQuery(client, key, new Request(`https://example.test${pathname}`), pathname)
    assert.deepEqual(client.getQueryData(key), ["fresh"], "Active lists remain intact")
    unsubscribe()
  }

  const notesKey = ["/example", "list"]
  for (const path of ["/example/note-id", "/example/new"]) {
    clearMobileNavigationQuery(client, notesKey, new Request(`https://example.test${path}`), "/example")
    assert.deepEqual(client.getQueryData(notesKey), ["fresh"], "Dialogs preserve the underlying list")
  }

  clearMobileNavigationQuery(client, notesKey, new Request("https://example.test/example/"), "/example")
  assert.equal(client.getQueryData(notesKey), undefined, "Trailing slashes count as main navigation")

  Reflect.deleteProperty(globalThis, "window")
  client.setQueryData(notesKey, ["server"])
  clearMobileNavigationQuery(client, notesKey, new Request("https://example.test/example"), "/example")
  assert.deepEqual(client.getQueryData(notesKey), ["server"], "Server rendering keeps its data")

  console.info("PASS mobile navigation fetches fresh data with loading UI and preserves desktop, counts, active lists, dialogs, and SSR")
} finally {
  client.clear()
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow)
  else Reflect.deleteProperty(globalThis, "window")
}
