import assert from "node:assert/strict"

import { getCalendarBookingDurationStops, getCalendarBookingDurationStep, getCalendarBookingDragDuration } from "../app/lib/calendar/booking-duration-steps.ts"
import { getCalendarDraftService, getCalendarServiceSelectionLength } from "../app/lib/calendar/booking-service-suggestion.ts"

const options = { maxDuration: 150, serviceDurations: [5, 20, 30, 90, 90] }
assert.deepEqual(getCalendarBookingDurationStops(options), [15, 20, 30, 90, 105, 120, 135, 150], "Service lengths remain the only regular stops until the longest service")
assert.equal(getCalendarBookingDurationStep({ ...options, length: 30, direction: 1 }), 90)
assert.equal(getCalendarBookingDurationStep({ ...options, length: 90, direction: -1 }), 30)
assert.equal(getCalendarBookingDurationStep({ ...options, length: 90, direction: 1 }), 105)
assert.equal(getCalendarBookingDurationStep({ ...options, length: 25, direction: 1 }), 30, "Custom lengths step to the next service length")
assert.equal(getCalendarBookingDurationStep({ ...options, length: 25, direction: -1 }), 20)
assert.equal(getCalendarBookingDurationStep({ ...options, maxDuration: 42, length: 30, direction: 1 }), 42, "The picker can fill the available gap")
assert.equal(getCalendarBookingDurationStep({ ...options, length: 15, direction: -1 }), 15)
assert.equal(getCalendarBookingDurationStep({ ...options, length: null, direction: 1 }), 15)
assert.deepEqual(getCalendarBookingDurationStops({ maxDuration: 130, serviceDurations: [20, 80] }), [15, 20, 80, 95, 110, 125], "Fifteen-minute steps start after an off-grid longest service")
assert.equal(getCalendarBookingDragDuration({ ...options, requestedDuration: 70 }), 90, "Dragging follows the same service stops as the picker")
assert.equal(getCalendarBookingDragDuration({ ...options, maxDuration: 42, requestedDuration: 42 }), 42)
assert.deepEqual(getCalendarBookingDurationStops({ maxDuration: 60, serviceDurations: [] }), [15, 30, 45, 60])

const services = [
  { id: "short", durationMinutes: 20, isActive: true },
  { id: "regular", durationMinutes: 30, isActive: true },
  { id: "popular", durationMinutes: 30, isActive: true },
  { id: "hidden", durationMinutes: 30, isActive: false },
]
const usage = [{ serviceId: "short", bookings: 100 }, { serviceId: "regular", bookings: 4 }, { serviceId: "popular", bookings: 12 }, { serviceId: "hidden", bookings: 200 }]
assert.equal(getCalendarDraftService(services, usage)?.id, "short", "A new flow defaults to its most-booked active service")
assert.equal(getCalendarDraftService(services, usage, 30)?.id, "popular", "Length matching takes priority before popularity")
assert.equal(getCalendarDraftService(services, usage, 25), undefined, "Custom draft lengths leave the service unselected")
assert.equal(getCalendarDraftService(services, [], 30)?.id, "regular", "Ties use the existing service order")
assert.equal(getCalendarDraftService([], [], 30), undefined)
assert.equal(getCalendarServiceSelectionLength({ length: 20, defaultLength: 90, preserveCustomLength: true, serviceDurations: [20, 30, 90] }), 90, "Picking a service replaces a standard draft length with its default")
assert.equal(getCalendarServiceSelectionLength({ length: 25, defaultLength: 90, preserveCustomLength: true, serviceDurations: [20, 30, 90] }), 25, "Picking a service preserves a custom draft length")
assert.equal(getCalendarServiceSelectionLength({ length: 30, defaultLength: 90, preserveCustomLength: false, serviceDurations: [90] }), 90, "The initial placeholder length does not become a custom override")
console.info("PASS shared smart duration stops, picker stepping, popularity, exact matching and custom-length preservation")
