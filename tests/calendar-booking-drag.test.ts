import assert from "node:assert/strict"

import { getCalendarBookingDragPosition, getCalendarBookingDragRange, getCalendarBookingResizeRange, getCalendarDragScrollDelta } from "../app/lib/calendar/booking-drag.ts"

const base = { intervalMinutes: 15, minDurationMinutes: 15, minute: 630, offset: 15, durationMinutes: 45, startMinute: 480, endMinute: 1080, blocked: [] }
assert.deepEqual(getCalendarBookingDragRange(base), { startMinute: 615, endMinute: 660 }, "Moving keeps the grab offset and original length")
assert.deepEqual(getCalendarBookingDragRange({ ...base, minute: 633 }), { startMinute: 615, endMinute: 660 }, "Moves snap to fifteen-minute starts")
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

const resize = { intervalMinutes: 15, minDurationMinutes: 15, minute: 690, bookingStartMinute: 600, startMinute: 480, endMinute: 1080, blocked: [] }
assert.deepEqual(getCalendarBookingResizeRange(resize), { startMinute: 600, endMinute: 690 }, "Resizing extends the end while keeping the start fixed")
assert.deepEqual(getCalendarBookingResizeRange({ ...resize, minute: 620 }), { startMinute: 600, endMinute: 615 }, "The bottom handle can shorten a booking")
assert.deepEqual(getCalendarBookingResizeRange({ ...resize, minute: 623 }), { startMinute: 600, endMinute: 630 }, "Duration snaps to fifteen-minute steps")
assert.deepEqual(getCalendarBookingResizeRange({ ...resize, minute: 400 }), { startMinute: 600, endMinute: 615 }, "Resizing cannot shorten a booking below fifteen minutes")
assert.deepEqual(getCalendarBookingResizeRange({ ...resize, minute: 1400 }), { startMinute: 600, endMinute: 1080 }, "Resizing stops at closing time")
assert.deepEqual(getCalendarBookingResizeRange({ ...resize, blocked: [{ startMinute: 660, endMinute: 720 }] }), { startMinute: 600, endMinute: 660 }, "The end stops at the next booking or blocked time")
assert.deepEqual(getCalendarBookingResizeRange({ ...resize, minute: 900, blocked: [{ startMinute: 660, endMinute: 720 }, { startMinute: 780, endMinute: 840 }] }), { startMinute: 600, endMinute: 660 }, "Resizing cannot jump past an occupied stretch")
assert.deepEqual(getCalendarBookingResizeRange({ ...resize, blocked: [{ startMinute: 540, endMinute: 600 }] }), { startMinute: 600, endMinute: 690 }, "An earlier booking touching the start does not block resizing")
assert.equal(getCalendarBookingResizeRange({ ...resize, blocked: [{ startMinute: 590, endMinute: 610 }] }), null, "An occupied start cannot produce a valid resized booking")
assert.equal(getCalendarBookingResizeRange({ ...resize, endMinute: 610 }), null, "There must be room for the minimum duration")
assert.deepEqual(getCalendarBookingResizeRange({ ...resize, bookingStartMinute: 603, blocked: [{ startMinute: 662, endMinute: 720 }] }), { startMinute: 603, endMinute: 662 }, "Off-grid starts stay fixed and cannot snap across a conflict")
console.info("PASS bottom resizing, fixed starts, minimum duration, snapping, working hours and conflicts")

assert.equal(getCalendarBookingDragRange({ ...base, durationMinutes: 10 }), null, "Bookings shorter than fifteen minutes cannot be moved into a new booking range")
assert.equal(getCalendarBookingResizeRange({ ...resize, blocked: [{ startMinute: 610, endMinute: 650 }] }), null, "A gap shorter than fifteen minutes cannot be resized into a booking")

assert.deepEqual(getCalendarBookingDragRange({ ...base, minute: 633, intervalMinutes: 5 }), { startMinute: 620, endMinute: 665 }, "The drag interval can be configured")
assert.equal(getCalendarBookingDragRange({ ...base, durationMinutes: 15, minDurationMinutes: 30 }), null, "The minimum duration can be configured")
assert.deepEqual(getCalendarBookingResizeRange({ ...resize, minute: 610, minDurationMinutes: 30 }), { startMinute: 600, endMinute: 630 }, "Resizing respects a custom minimum")
assert.deepEqual(getCalendarBookingDragRange({ ...base, minute: 1080, durationMinutes: 20 }), { startMinute: 1050, endMinute: 1070 }, "Closing-time clamping keeps starts on the fifteen-minute grid")
assert.deepEqual(getCalendarBookingDragRange({ ...base, startMinute: 487, minute: 480 }), { startMinute: 495, endMinute: 540 }, "Opening-time clamping keeps starts on the fifteen-minute grid")

// Production defaults use fifteen-minute steps independently of the service length
const defaultMove = { minute: 633, offset: 15, durationMinutes: 45, startMinute: 480, endMinute: 1080, blocked: [] }
assert.deepEqual(getCalendarBookingDragRange(defaultMove), { startMinute: 615, endMinute: 660 }, "Moves use fifteen-minute starts and preserve an off-grid service duration")
assert.deepEqual(getCalendarBookingDragRange({ ...defaultMove, durationMinutes: 15 }), { startMinute: 615, endMinute: 630 }, "Fifteen-minute bookings can be moved")
const defaultResize = { minute: 600, bookingStartMinute: 600, startMinute: 480, endMinute: 1080, blocked: [] }
assert.deepEqual(getCalendarBookingResizeRange(defaultResize), { startMinute: 600, endMinute: 615 }, "A booking can shrink to fifteen minutes regardless of its service length")
assert.deepEqual(getCalendarBookingResizeRange({ ...defaultResize, minute: 626 }), { startMinute: 600, endMinute: 630 }, "Resizing uses fifteen-minute duration steps")
assert.deepEqual(getCalendarBookingResizeRange({ ...defaultResize, minute: 660, blocked: [{ startMinute: 615, endMinute: 650 }] }), { startMinute: 600, endMinute: 615 }, "Resizing fits a fifteen-minute gap")
assert.equal(getCalendarBookingResizeRange({ ...defaultResize, endMinute: 614 }), null, "A gap below fifteen minutes remains unavailable")
console.info("PASS fifteen-minute booking movement and resizing below service length")

const neighbour = { startMinute: 600, endMinute: 620 }
const adjacentMove = { ...defaultMove, minute: 622, offset: 0, durationMinutes: 30, blocked: [neighbour], snapAround: [neighbour] }
assert.deepEqual(getCalendarBookingDragRange(adjacentMove), { startMinute: 620, endMinute: 650 }, "Moving snaps directly after a twenty-minute service")
assert.deepEqual(getCalendarBookingDragRange({ ...adjacentMove, minute: 568 }), { startMinute: 570, endMinute: 600 }, "Moving can fit directly before the next booking")
assert.deepEqual(getCalendarBookingDragRange({ ...adjacentMove, minute: 660 }), { startMinute: 660, endMinute: 690 }, "Distant bookings do not pull the pointer off its grid start")
assert.deepEqual(getCalendarBookingDragRange({ ...adjacentMove, minute: 626, beforeMinutes: 5, afterMinutes: 10 }), { startMinute: 625, endMinute: 655 }, "Adjacent starts leave the moving service's preparation buffer")
assert.deepEqual(getCalendarBookingDragRange({ ...adjacentMove, minute: 560, afterMinutes: 10 }), { startMinute: 560, endMinute: 590 }, "Snapping before a booking includes cleanup time")
assert.equal(getCalendarBookingDragRange({ ...adjacentMove, startMinute: 600, endMinute: 640 }), null, "An adjacent candidate must fit within calendar hours")
assert.equal(getCalendarBookingDragRange({ ...adjacentMove, isAvailable: () => false }), null, "Adjacent starts must pass availability checks")
assert.deepEqual(getCalendarBookingDragRange({ ...adjacentMove, startMinute: 620, endMinute: 650 }), { startMinute: 620, endMinute: 650 }, "An exact off-grid gap remains usable even when no grid start fits")
assert.deepEqual(getCalendarBookingResizeRange({ ...defaultResize, minute: 641, blocked: [{ startMinute: 640, endMinute: 700 }] }), { startMinute: 600, endMinute: 640 }, "Resizing fills an off-grid gap to the next booking")
assert.deepEqual(getCalendarBookingResizeRange({ ...defaultResize, minute: 635, afterMinutes: 5, blocked: [{ startMinute: 640, endMinute: 700 }] }), { startMinute: 600, endMinute: 635 }, "Resize stops leave the service cleanup buffer")
assert.deepEqual(getCalendarBookingResizeRange({ ...defaultResize, minute: 620, serviceDurationMinutes: 20 }), { startMinute: 600, endMinute: 620 }, "The service's original duration is a resize stop")
assert.equal(getCalendarBookingResizeRange({ ...defaultResize, minute: 620, blocked: [{ startMinute: 610, endMinute: 650 }] }), null, "Gap filling cannot bypass the fifteen-minute minimum")
console.info("PASS adjacent booking snapping, off-grid gaps, service durations and buffers")

const smartResize = { ...defaultResize, serviceDurations: [5, 10, 20, 20, 30, 50, 90] }
for (const [requested, expected] of [[5, 15], [20, 20], [26, 30], [44, 50], [55, 50], [68, 50], [84, 90], [100, 105]] as const) {
  assert.equal(getCalendarBookingResizeRange({ ...smartResize, minute: 600 + requested })?.endMinute, 600 + expected, `A ${requested}-minute resize snaps to the ${expected}-minute service stop`)
}
assert.deepEqual(getCalendarBookingResizeRange({ ...smartResize, minute: 640, blocked: [{ startMinute: 640, endMinute: 700 }] }), { startMinute: 600, endMinute: 640 }, "Exact gap filling remains available beside service duration stops")
assert.deepEqual(getCalendarBookingResizeRange({ ...smartResize, minute: 625, serviceDurationMinutes: 25 }), { startMinute: 600, endMinute: 625 }, "An existing custom booking length remains a stop")
assert.deepEqual(getCalendarBookingResizeRange({ ...smartResize, serviceDurations: [], minute: 643 }), { startMinute: 600, endMinute: 645 }, "An empty service list falls back to regular duration steps")
console.info("PASS service duration stops, fifteen-minute minimum, steps after the longest service, fallback and gap filling")

assert.deepEqual(getCalendarBookingDragRange({ ...defaultMove, snapToInterval: false, minute: 633, offset: 0 }), { startMinute: 633, endMinute: 678 }, "Existing bookings can move to minute-precise starts")
assert.deepEqual(getCalendarBookingDragRange({ ...defaultMove, snapToInterval: false, minute: 605, offset: 0 }), { startMinute: 605, endMinute: 650 }, "Moving between members keeps an existing off-grid start")
assert.deepEqual(getCalendarBookingDragRange({ ...adjacentMove, snapToInterval: false, minute: 623 }), { startMinute: 620, endMinute: 650 }, "Minute-precise movement still snaps to nearby booking boundaries")
console.info("PASS off-grid existing booking movement with adjacent snapping")
