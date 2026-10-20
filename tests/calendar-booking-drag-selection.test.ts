import assert from "node:assert/strict"

import { getCalendarBookingDragSelection } from "../app/lib/calendar/booking-drag-selection.ts"

const initial = { day: "2026-10-28", member: { id: "alice", name: "Alice" }, startMinute: 540, endMinute: 560 }
const latest = { ...initial, startMinute: 600, endMinute: 620 }
const oldRoute = { appointmentId: "a", selection: initial }
const newDrop = { appointmentId: "b", selection: latest }

assert.equal(getCalendarBookingDragSelection(undefined, oldRoute, "a"), initial, "Directly opening a dragged edit initializes from route state")
assert.equal(getCalendarBookingDragSelection({ appointmentId: "a", selection: latest }, oldRoute, "a"), latest, "Repeated drops keep the most recent time")
assert.equal(getCalendarBookingDragSelection(newDrop, oldRoute, "a"), undefined, "The outgoing form cannot fall back to its old drop while navigating to another booking")
assert.equal(getCalendarBookingDragSelection(newDrop, oldRoute, "b"), latest, "The incoming form receives the newest drop before its route finishes loading")
assert.equal(getCalendarBookingDragSelection(newDrop, { selection: initial }), undefined, "An outgoing create flow cannot restore its old placeholder after switching to an existing booking")
assert.equal(getCalendarBookingDragSelection({ selection: latest }, oldRoute, "a"), undefined, "Switching to creation prevents a previous edit from restoring its route state")
assert.equal(getCalendarBookingDragSelection({ selection: latest }, { selection: initial }), latest, "Rapid create-placeholder moves also use the latest drop")
console.info("PASS rapid switches and repeated drops cannot restore stale route drag selections")
