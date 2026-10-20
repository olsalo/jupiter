import assert from "node:assert/strict"
import { mock } from "node:test"

import { isCalendarCurrentTimeVisible, subscribeCalendarClock } from "../app/lib/calendar/clock.ts"

const start = Date.parse("2026-10-14T09:30:42.250Z")
mock.timers.enable({ apis: ["Date", "setTimeout"], now: start })

try {
  const updates: number[] = []
  const stop = subscribeCalendarClock((now) => updates.push(now.getTime()))
  assert.deepEqual(updates, [start], "The device clock is read immediately")
  mock.timers.tick(17_749)
  assert.equal(updates.length, 1, "The label waits for the next minute boundary")
  mock.timers.tick(1)
  assert.equal(updates.at(-1), Date.parse("2026-10-14T09:31:00Z"), "The label changes with the device minute")
  mock.timers.tick(60_000)
  assert.equal(updates.at(-1), Date.parse("2026-10-14T09:32:00Z"), "Subsequent updates remain aligned")

  mock.timers.setTime(Date.parse("2026-10-14T09:40:18Z"))
  mock.timers.tick(60_000)
  assert.equal(updates.at(-1), Date.parse("2026-10-14T09:41:18Z"), "A delayed timer reads the actual device time")
  mock.timers.tick(42_000)
  assert.equal(updates.at(-1), Date.parse("2026-10-14T09:42:00Z"), "Delayed updates realign to the next minute")

  stop()
  const count = updates.length
  mock.timers.tick(120_000)
  assert.equal(updates.length, count, "Unmounting cancels clock updates")
  console.info("PASS calendar clock minute boundaries, delayed timers and cleanup")
} finally {
  mock.timers.reset()
}

for (const [minute, visible] of [[480, false], [484, false], [485, true], [750, true], [1075, true], [1076, false], [1080, false]] as const) {
  assert.equal(isCalendarCurrentTimeVisible(minute, 480, 1080), visible, "Current-time markers keep a five-minute inset at each time edge")
}
assert.equal(isCalendarCurrentTimeVisible(484, 480, 488), false, "A range shorter than ten minutes cannot show a current-time marker")
console.info("PASS shared current-time visibility boundaries")
