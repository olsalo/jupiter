import assert from "node:assert/strict"

import { getCalendarBookingDragPosition, getCalendarBookingDragRange, getCalendarDragScrollDelta } from "../app/lib/calendar-booking-drag.ts"

const base = { minute: 630, offset: 15, durationMinutes: 45, startMinute: 480, endMinute: 1080, blocked: [] }
assert.deepEqual(getCalendarBookingDragRange(base), { startMinute: 615, endMinute: 660 }, "Moving keeps the grab offset and original length")
assert.deepEqual(getCalendarBookingDragRange({ ...base, minute: 633 }), { startMinute: 620, endMinute: 665 }, "Moves snap to five-minute starts")
assert.deepEqual(getCalendarBookingDragRange({ ...base, minute: 480 }), { startMinute: 480, endMinute: 525 }, "Moves stay within the top edge")
assert.deepEqual(getCalendarBookingDragRange({ ...base, minute: 1080 }), { startMinute: 1035, endMinute: 1080 }, "The full booking stays within the bottom edge")
assert.equal(getCalendarBookingDragRange({ ...base, durationMinutes: 700 }), null, "A booking longer than the day cannot be dropped")
assert.equal(getCalendarBookingDragRange({ ...base, blocked: [{ startMinute: 650, endMinute: 700 }] }), null, "A drop cannot overlap blocked time or another booking")
assert.deepEqual(getCalendarBookingDragRange({ ...base, blocked: [{ startMinute: 660, endMinute: 700 }] }), { startMinute: 615, endMinute: 660 }, "Touching bookings are allowed")
console.info("PASS booking drag offset, duration, snapping, day boundaries and overlap rejection")

const existing = { startMinute: 600, endMinute: 660 }
const smart = { ...base, blocked: [existing], snapAround: [existing] }
assert.deepEqual(getCalendarBookingDragRange({ ...smart, minute: 615 }), { startMinute: 555, endMinute: 600 }, "Dropping near the top of a booking fits directly before it")
assert.deepEqual(getCalendarBookingDragRange({ ...smart, minute: 665 }), { startMinute: 660, endMinute: 705 }, "Dropping near the bottom fits directly after it")
assert.deepEqual(getCalendarBookingDragRange({ ...smart, minute: 615, blocked: [existing, { startMinute: 540, endMinute: 600 }] }), { startMinute: 660, endMinute: 705 }, "If the closer side is unavailable, use the other side")
assert.equal(getCalendarBookingDragRange({ ...smart, blocked: [existing, { startMinute: 480, endMinute: 600 }, { startMinute: 660, endMinute: 1080 }] }), null, "No adjacent free space still rejects the drop")
assert.deepEqual(getCalendarBookingDragRange({ ...smart, minute: 615, isAvailable: (range) => range.startMinute >= 630 }), { startMinute: 660, endMinute: 705 }, "A past start cannot win over an available future start")
const consecutive = [existing, { startMinute: 660, endMinute: 690 }]
assert.deepEqual(getCalendarBookingDragRange({ ...smart, minute: 665, blocked: consecutive, snapAround: consecutive }), { startMinute: 690, endMinute: 735 }, "Consecutive bookings snap to the nearest free edge of the group")
assert.equal(getCalendarBookingDragRange({ ...base, blocked: [existing] }), null, "Unavailable time alone does not cause a booking to jump elsewhere")
assert.deepEqual(getCalendarBookingDragRange({ ...base, snapAround: [] }), { startMinute: 615, endMinute: 660 }, "Allowing simultaneous bookings preserves the requested overlapping time")
assert.deepEqual(getCalendarBookingDragRange({ ...smart, minute: 615, startMinute: 600 }), { startMinute: 660, endMinute: 705 }, "A candidate outside calendar hours falls back to the other side")
assert.deepEqual(getCalendarBookingDragRange({ ...smart, minute: 665, endMinute: 690 }), { startMinute: 555, endMinute: 600 }, "A booking that cannot fit before closing falls back above")
console.info("PASS smart release before and after bookings, unavailable sides, grouped bookings, past times and calendar boundaries")

const viewport = { left: 100, top: 200, width: 600, height: 500 }
assert.deepEqual(getCalendarDragScrollDelta({ x: 400, y: 450 }, viewport, 16), { left: 0, top: 0 }, "Dragging in the middle does not scroll")
assert.ok(getCalendarDragScrollDelta({ x: 400, y: 201 }, viewport, 16).top < 0, "The top edge scrolls to earlier times")
assert.ok(getCalendarDragScrollDelta({ x: 400, y: 699 }, viewport, 16).top > 0, "The bottom edge scrolls to later times")
assert.ok(getCalendarDragScrollDelta({ x: 101, y: 450 }, viewport, 16).left < 0, "The left edge reveals earlier days and members")
assert.ok(getCalendarDragScrollDelta({ x: 699, y: 450 }, viewport, 16).left > 0, "The right edge reveals later days and members")
assert.ok(getCalendarDragScrollDelta({ x: 400, y: 699 }, viewport, 16).top > getCalendarDragScrollDelta({ x: 400, y: 670 }, viewport, 16).top, "Scrolling speeds up closer to the edge")
assert.deepEqual(getCalendarDragScrollDelta({ x: 1000, y: 1000 }, viewport, 16), { left: 0, top: 0 }, "Moving outside the calendar stops edge scrolling")
assert.equal(getCalendarDragScrollDelta({ x: 400, y: 699 }, viewport, 500).top, getCalendarDragScrollDelta({ x: 400, y: 699 }, viewport, 32).top, "Returning to the tab cannot cause a large scroll jump")
let top = 0
for (let frame = 0; frame < 120; frame += 1) top += getCalendarDragScrollDelta({ x: 400, y: 699 }, viewport, 16).top
assert.ok(top > 1000, "Holding the pointer at the edge continues scrolling without pointer movement")
console.info("PASS drag edge scrolling in both axes, stationary pointers, speed ramping and frame limits")

const card = { left: 250, top: 300, width: 150, height: 60 }
assert.deepEqual(getCalendarBookingDragPosition(card, viewport), { left: 250, top: 300 }, "A block inside the calendar follows the pointer freely")
assert.deepEqual(getCalendarBookingDragPosition({ ...card, left: -400, top: -100 }, viewport), { left: 100, top: 200 }, "The block cannot cross the calendar's left or top edges")
assert.deepEqual(getCalendarBookingDragPosition({ ...card, left: 900, top: 950 }, viewport), { left: 550, top: 640 }, "The entire block stays inside the right and bottom edges")
assert.deepEqual(getCalendarBookingDragPosition({ ...card, width: 800, height: 700 }, viewport), { left: 100, top: 200 }, "Oversized blocks anchor inside the viewport and their overflowing content is clipped")
assert.deepEqual(getCalendarBookingDragPosition({ ...card, left: 900 }, { ...viewport, width: 400 }), { left: 350, top: 300 }, "Opening a panel also constrains the block to the narrower calendar")
console.info("PASS constrained block movement on every edge, panel resizing and oversized bookings")
