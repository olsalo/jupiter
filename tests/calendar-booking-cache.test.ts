import assert from "node:assert/strict"
import { QueryClient } from "@tanstack/react-query"

import { cacheCalendarBooking, recordCalendarBookingVersion } from "../app/lib/calendar-booking-cache.ts"

type Booking = Parameters<typeof cacheCalendarBooking>[2]
const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
const listKey = [["appointment", "list"]] as const
const day = (value: string) => new Date(value)
const week = { from: day("2026-10-12T00:00:00Z"), to: day("2026-10-19T00:00:00Z") }
const original: Booking = {
  id: "moving", startsAt: day("2026-10-13T09:00:00Z"), endsAt: day("2026-10-13T10:00:00Z"),
  timezone: "Europe/Helsinki", status: "CONFIRMED", source: "ADMIN",
  customer: { id: "aino", firstName: "Aino", lastName: "Virtanen" },
  staffMember: { id: "alice", name: "Alice" }, location: { id: "shop", name: "Shop" },
  services: [{ serviceId: "service", name: "Consultation", durationMinutes: 60, service: { color: "#30968d" } }],
}
const moved: Booking = {
  ...original, startsAt: day("2026-10-14T12:00:00Z"), endsAt: day("2026-10-14T12:30:00Z"),
  staffMember: { id: "bob", name: "Bob" },
  customer: { id: "bella", firstName: "Bella", lastName: null },
  services: [{ ...original.services[0], durationMinutes: 30 }],
}
const neighbor: Booking = { ...original, id: "neighbor", startsAt: day("2026-10-14T13:00:00Z"), endsAt: day("2026-10-14T14:00:00Z") }
const key = (input: object) => [...listKey, { input, type: "query" }]
const weekKey = key(week)
const oldDayKey = key({ from: day("2026-10-13T00:00:00Z"), to: day("2026-10-14T00:00:00Z") })
const newDayKey = key({ from: day("2026-10-14T00:00:00Z"), to: day("2026-10-15T00:00:00Z") })
const aliceKey = key({ ...week, staffMemberId: "alice" })
const bobKey = key({ ...week, staffMemberId: "bob" })
const oldCustomerKey = key({ ...week, customerId: "aino" })
const newCustomerKey = key({ ...week, customerId: "bella" })
const otherLocationKey = key({ ...week, locationId: "elsewhere" })
const cancelledKey = key({ ...week, status: "CANCELLED" })
const missingKey = key({ ...week, staffMemberId: "not-loaded" })
try {
  for (const queryKey of [weekKey, oldDayKey, aliceKey, oldCustomerKey]) client.setQueryData(queryKey, [original])
  for (const queryKey of [bobKey, newCustomerKey, otherLocationKey, cancelledKey]) client.setQueryData(queryKey, [])
  client.setQueryData(newDayKey, [neighbor])
  cacheCalendarBooking(client, listKey, moved)
  assert.deepEqual(client.getQueryData(weekKey), [moved], "Saving replaces the old time before the preview is removed")
  assert.deepEqual(client.getQueryData(oldDayKey), [], "A moved booking disappears from its former day")
  assert.deepEqual(client.getQueryData(newDayKey), [moved, neighbor], "It appears in the destination day without losing other bookings")
  assert.deepEqual(client.getQueryData(aliceKey), [], "Staff transfer removes it from the previous member's cache")
  assert.deepEqual(client.getQueryData(bobKey), [moved], "Staff transfer inserts it into the new member's cache")
  assert.deepEqual(client.getQueryData(oldCustomerKey), [], "Customer changes remove it from the old customer's filtered calendar")
  assert.deepEqual(client.getQueryData(newCustomerKey), [moved], "Customer changes populate the new customer's calendar")
  assert.deepEqual(client.getQueryData(otherLocationKey), [], "Unrelated locations remain untouched")
  assert.deepEqual(client.getQueryData(cancelledKey), [], "Status-filtered calendars keep their filter")
  assert.equal(client.getQueryData(missingKey), undefined, "Saving does not create incomplete caches for unloaded ranges")
  cacheCalendarBooking(client, listKey, moved)
  assert.deepEqual(client.getQueryData(newDayKey), [moved, neighbor], "Repeating a cache update does not duplicate the booking")
  console.info("PASS confirmed cache updates across days, members, customers, filters and sorted ranges")

  let completeOldFetch!: (bookings: Booking[]) => void
  const oldFetch = client.fetchQuery({
    queryKey: weekKey,
    queryFn: () => new Promise<Booking[]>((resolve) => { completeOldFetch = resolve }),
    staleTime: 0,
  }).catch(() => {})
  await client.cancelQueries({ queryKey: listKey })
  cacheCalendarBooking(client, listKey, moved)
  completeOldFetch([original])
  await oldFetch
  assert.deepEqual(client.getQueryData(weekKey), [moved], "An older calendar request cannot overwrite a confirmed move")
  console.info("PASS cancelled in-flight refresh cannot roll a saved booking back")

  const availabilityKey = [["availability", "getBookingTimes"], { input: week, type: "query" }]
  client.setQueryData(availabilityKey, { days: [] })
  const observeCalendar = (bookings: Booking[]) => {
    if (recordCalendarBookingVersion(client, "week", JSON.stringify(bookings))) {
      return client.invalidateQueries({ queryKey: availabilityKey, refetchType: "none" })
    }
  }
  await observeCalendar([original])
  await observeCalendar([{ ...original }])
  assert.equal(client.getQueryState(availabilityKey)?.isInvalidated, false, "An identical live refresh keeps cached availability fresh")
  // A new observer after leaving and returning to the calendar still compares saved versions
  await observeCalendar([moved])
  assert.equal(client.getQueryState(availabilityKey)?.isInvalidated, true, "Changed server bookings invalidate availability even across calendar remounts")
  console.info("PASS unchanged live data reuses availability while changed bookings invalidate it across remounts")
} finally {
  client.clear()
}
