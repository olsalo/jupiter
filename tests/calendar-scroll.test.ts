import assert from "node:assert/strict"

import { getCalendarBookingScrollPosition, getCalendarBookingRevealScrollLeft, getCalendarTodayScrollLeft } from "../app/lib/calendar-scroll.ts"

const bounds = (left: number, top: number, width: number, height: number) => ({ left, top, width, height })
const viewport = {
  scrollLeft: 0,
  scrollTop: 0,
  scrollWidth: 2240,
  scrollHeight: 1568,
  clientWidth: 640,
  clientHeight: 480,
  getBoundingClientRect: () => bounds(180, 220, 640, 480),
}

// A Thursday staff lane far to the right and a late-afternoon booking
// must both come into view even when the page itself has a header and sidebar
const lane = bounds(1620, 236, 160, 1536)
const booking = bounds(1624, 1388, 152, 124)
const target = getCalendarBookingScrollPosition(viewport, lane, booking)
assert.deepEqual(target, { left: 1200, top: 990 })

// Once all calendar scroll areas reach the target, measuring again must leave
// them there rather than using page coordinates as another scroll offset
assert.deepEqual(getCalendarBookingScrollPosition(
  { ...viewport, scrollLeft: target.left, scrollTop: target.top },
  { ...lane, left: lane.left - target.left },
  { ...booking, left: booking.left - target.left, top: booking.top - target.top },
), target)

assert.deepEqual(getCalendarBookingScrollPosition(viewport, bounds(180, 236, 160, 1536), bounds(184, 236, 152, 60)), { left: 0, top: 0 }, "Early bookings stay within the start of the calendar")
assert.deepEqual(getCalendarBookingScrollPosition(viewport, bounds(2260, 236, 160, 1536), bounds(2264, 1720, 152, 60)), { left: 1600, top: 1088 }, "Late bookings stay within the last scrollable position")
assert.equal(getCalendarBookingScrollPosition({ ...viewport, clientWidth: 2240 }, lane, booking).left, 0, "A day view that fits the screen needs no horizontal scroll")

const week = ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"]
assert.equal(getCalendarTodayScrollLeft(week, "2026-10-14", 1600, 640), 480, "Today is centered across all its staff columns")
assert.equal(getCalendarTodayScrollLeft(week, "2026-10-12", 1600, 640), 0, "The first day stops at the start of the grid")
assert.equal(getCalendarTodayScrollLeft(week, "2026-10-16", 1600, 640), 960, "The last day stops at the end of the grid")
assert.equal(getCalendarTodayScrollLeft(week, "2026-10-14", 1600, 1600), 0, "A week that fits the viewport needs no scroll")
assert.equal(getCalendarTodayScrollLeft(week, "2026-10-21", 1600, 640), null, "Other weeks keep their default position")
assert.equal(getCalendarTodayScrollLeft(week, "2026-10-17", 1600, 640), null, "A closed day without a column is not a scroll target")

console.info("PASS draft centering in both axes, existing scroll offsets, page offsets, scroll limits and day view")

const narrowed = { ...viewport, scrollLeft: 400, clientWidth: 932, getBoundingClientRect: () => bounds(166, 251, 932, 795) }
assert.equal(getCalendarBookingRevealScrollLeft(narrowed, bounds(500, 300, 152, 40)), 400, "Opening the panel leaves a fully visible booking and the existing view untouched")
assert.equal(getCalendarBookingRevealScrollLeft(narrowed, bounds(1050, 300, 152, 40)), 516, "A booking hidden under the panel scrolls just far enough to show its right edge with a little space")
assert.equal(getCalendarBookingRevealScrollLeft(narrowed, bounds(130, 300, 152, 40)), 352, "Switching to a booking clipped at the left reveals its left edge")
assert.equal(getCalendarBookingRevealScrollLeft({ ...narrowed, scrollLeft: 0 }, bounds(160, 300, 152, 40)), 0, "Revealing a booking never scrolls before the start")
assert.equal(getCalendarBookingRevealScrollLeft({ ...narrowed, scrollLeft: 1300 }, bounds(1800, 300, 152, 40)), 1308, "Revealing a booking respects the final scroll position")
assert.equal(getCalendarBookingRevealScrollLeft({ ...narrowed, clientWidth: 2240, scrollLeft: 0 }, bounds(170, 300, 2100, 40)), 0, "A responsive day view that fits does not move")
console.info("PASS reveal only clipped bookings, minimum scrolling, existing view preservation and scroll bounds")
