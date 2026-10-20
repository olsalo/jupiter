import assert from "node:assert/strict"
import { mock } from "node:test"

import { calendarBookingsQueryOptions, calendarAvailabilityQueryOptions, calendarPanelQueryOptions, calendarReferenceQueryOptions } from "../app/lib/calendar/query-options.ts"
import { queryCacheOptions } from "../app/lib/query-cache.ts"

// Enable QueryObserver's browser timers without a DOM or a running app
Object.defineProperty(globalThis, "window", { configurable: true, value: { addEventListener() {}, removeEventListener() {} } })
const { QueryClient, QueryObserver, focusManager } = await import("@tanstack/query-core")
mock.timers.enable({ apis: ["Date", "setTimeout", "setInterval"], now: 1000 })
const client = new QueryClient({ defaultOptions: { queries: { ...queryCacheOptions, retry: false } } })
const unsubscribers: (() => void)[] = []
const requests = new Map<string, number>()
const query = (name: string) => ({ queryKey: [name], queryFn: async () => { requests.set(name, (requests.get(name) ?? 0) + 1); return { name } } })
const flush = async () => { for (let index = 0; index < 20; index += 1) await Promise.resolve() }
client.mount()
try {
  const reference = { ...query("reference"), ...calendarReferenceQueryOptions }
  const availability = { ...query("availability"), ...calendarAvailabilityQueryOptions }
  const panel = { ...query("panel"), ...calendarPanelQueryOptions }
  const calendar = { ...query("calendar"), ...calendarBookingsQueryOptions(false) }
  for (const options of [reference, availability, panel, calendar]) await client.query(options)
  for (let index = 0; index < 8; index += 1) unsubscribers.push(new QueryObserver(client, reference).subscribe(() => {}))
  const availabilityObserver = new QueryObserver(client, availability)
  let unsubscribeAvailability = availabilityObserver.subscribe(() => {})
  unsubscribers.push(() => unsubscribeAvailability())
  unsubscribers.push(new QueryObserver(client, panel).subscribe(() => {}))
  const calendarObserver = new QueryObserver(client, calendar)
  unsubscribers.push(calendarObserver.subscribe(() => {}))
  await flush()
  assert.equal(requests.get("reference"), 1, "Mounting calendar controls and a form reuses reference data")
  assert.equal(requests.get("availability"), 1, "Opening the form reuses fresh availability")
  for (let index = 0; index < 8; index += 1) availabilityObserver.setOptions({ ...availability, queryKey: [...availability.queryKey] })
  unsubscribeAvailability()
  unsubscribeAvailability = new QueryObserver(client, availability).subscribe(() => {})
  await flush()
  assert.equal(requests.get("availability"), 1, "Re-renders, start-time edits and reopening the same range do not refetch")

  mock.timers.tick(61_000)
  await flush()
  focusManager.setFocused(false)
  focusManager.setFocused(true)
  await flush()
  assert.equal(requests.get("reference"), 1, "Shared reference observers do not each create a polling request")
  assert.equal(requests.get("availability"), 1, "Availability does not poll or refetch on window focus")
  assert.equal(requests.get("panel"), 1, "The open edit panel does not poll or refetch on window focus")
  assert.equal(requests.get("calendar"), 2, "The calendar keeps its live booking refresh")

  calendarObserver.setOptions({ ...calendar, ...calendarBookingsQueryOptions(true) })
  mock.timers.tick(180_000)
  await flush()
  focusManager.setFocused(false)
  focusManager.setFocused(true)
  await flush()
  assert.equal(requests.get("calendar"), 2, "Dragging and editing pause live polling and focus refetches")
  availabilityObserver.setOptions({ ...availability, enabled: false })
  availabilityObserver.setOptions({ ...availability, enabled: true })
  await flush()
  assert.equal(requests.get("availability"), 1, "Repeated drops keep reusing the same day, member and length availability even after a minute")
  calendarObserver.setOptions({ ...calendar, ...calendarBookingsQueryOptions(false) })
  mock.timers.tick(60_000)
  await flush()
  assert.equal(requests.get("calendar"), 3, "Closing the edit resumes the calendar's live refresh")

  await client.invalidateQueries({ queryKey: ["availability"], refetchType: "none" })
  assert.equal(requests.get("availability"), 1, "Saving marks closing form data stale without fetching it again")
  unsubscribeAvailability()
  unsubscribeAvailability = new QueryObserver(client, availability).subscribe(() => {})
  await flush()
  assert.equal(requests.get("availability"), 2, "Reopening after a mutation fetches invalidated availability")

  const changedRange = { ...query("changed-range"), ...calendarAvailabilityQueryOptions }
  unsubscribers.push(new QueryObserver(client, changedRange).subscribe(() => {}))
  await flush()
  assert.equal(requests.get("changed-range"), 1, "Changing date, service or length fetches a new range once")
  const customerOptions = { ...query("customer-list"), ...calendarPanelQueryOptions }
  const customerObserver = new QueryObserver(client, { ...customerOptions, enabled: false })
  unsubscribers.push(customerObserver.subscribe(() => {}))
  await flush()
  assert.equal(requests.get("customer-list"), undefined, "The closed customer picker makes no list request")
  customerObserver.setOptions({ ...customerOptions, enabled: true })
  await flush()
  assert.equal(requests.get("customer-list"), 1, "Opening the customer picker loads its list once")
  customerObserver.setOptions({ ...customerOptions, enabled: false })
  customerObserver.setOptions({ ...customerOptions, enabled: true })
  await flush()
  assert.equal(requests.get("customer-list"), 1, "Reopening the picker reuses its cached list")
  console.info("PASS calendar request counts: shared references, repeated edits, remounts, polling, focus, save invalidation and lazy customer loading")
} finally {
  for (const unsubscribe of unsubscribers) unsubscribe()
  client.unmount()
  client.clear()
  focusManager.setFocused(undefined)
  mock.timers.reset()
  Reflect.deleteProperty(globalThis, "window")
}
