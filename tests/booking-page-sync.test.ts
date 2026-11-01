import assert from "node:assert/strict"
import { QueryClient, QueryObserver } from "@tanstack/react-query"
import { notifyBookingPageSaved, subscribeToBookingPageSaves } from "../app/lib/booking/booking-page-sync.ts"

const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, gcTime: Infinity, retry: false } } })
const queryKey = ["public-booking", "aino"]
client.setQueryData(queryKey, "Original title")
let requests = 0
let unrelatedSaves = 0
const observer = new QueryObserver(client, {
  queryKey,
  queryFn: async () => {
    requests += 1
    return "Updated title"
  },
})
let timeout: ReturnType<typeof setTimeout> | undefined
let stopObserving = () => {}
const refreshed = new Promise<void>((resolve, reject) => {
  timeout = setTimeout(() => reject(new Error("Public booking cache did not refresh after saving")), 2000)
  stopObserving = observer.subscribe((result) => {
    if (result.data === "Updated title" && !result.isFetching) resolve()
  })
})
const unsubscribe = subscribeToBookingPageSaves("aino", () => {
  void client.invalidateQueries({ queryKey })
})
const unsubscribeOther = subscribeToBookingPageSaves("other-business", () => { unrelatedSaves += 1 })

try {
  assert.equal(requests, 0, "A fresh public page stays cached until an admin save")
  notifyBookingPageSaved("aino")
  await refreshed
  assert.equal(client.getQueryData(queryKey), "Updated title")
  assert.equal(requests, 1, "A save immediately refetches fresh cached public data")
  assert.equal(unrelatedSaves, 0, "Saving another business does not refresh this page")
  console.info("PASS booking page saves refresh cached data across channels and stay scoped to the business")
} finally {
  clearTimeout(timeout)
  unsubscribe()
  unsubscribeOther()
  stopObserving()
  client.clear()
}
