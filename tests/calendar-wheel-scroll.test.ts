import assert from "node:assert/strict"
import { mock } from "node:test"

import { attachCalendarWheelScroll } from "../app/lib/calendar/wheel-scroll.ts"

class ScrollViewport extends EventTarget {
  scrollLeft = 100
  scrollTop = 100
  scrollWidth = 2000
  scrollHeight = 1200
  clientWidth = 800
  clientHeight = 500
}

const viewport = new ScrollViewport()
const track = new EventTarget()
let labelLeft = viewport.scrollLeft
let labelTop = viewport.scrollTop
let updates = 0
const wheel = (target: EventTarget, values: Partial<Pick<WheelEvent, "deltaX" | "deltaY" | "deltaMode" | "shiftKey" | "ctrlKey">>) => {
  const event = Object.assign(new Event("wheel", { cancelable: true }), { deltaX: 0, deltaY: 0, deltaMode: 0, shiftKey: false, ctrlKey: false, ...values })
  target.dispatchEvent(event)
  return event
}
mock.timers.enable({ apis: ["setTimeout"] })
const stop = attachCalendarWheelScroll(viewport as unknown as HTMLElement, [viewport, track] as unknown as HTMLElement[], ({ left, top }) => {
  viewport.scrollLeft = left
  viewport.scrollTop = top
  labelLeft = left
  labelTop = top
  updates += 1
})
const finishGesture = () => {
  viewport.dispatchEvent(new Event("scrollend"))
  mock.timers.tick(10)
}
try {
  const horizontal = wheel(viewport, { deltaX: 120, deltaY: 2 })
  assert.equal(horizontal.defaultPrevented, true, "Mouse scrolling runs on the same thread as label positioning")
  assert.equal(viewport.scrollLeft, 220)
  assert.equal(labelLeft, 220, "The label has already caught up before the wheel handler returns")
  wheel(viewport, { deltaX: 15, deltaY: 40 })
  assert.equal(viewport.scrollLeft, 235, "Diagonal movement keeps the gesture's original axis")
  assert.equal(viewport.scrollTop, 100)
  finishGesture()
  wheel(viewport, { deltaY: 60 })
  assert.equal(labelTop, 160, "Vertical wheel movement also updates labels immediately")
  finishGesture()
  wheel(track, { deltaY: 30, shiftKey: true })
  assert.equal(labelLeft, 265, "Shift-wheel on the companion track uses the same horizontal scroll path")
  finishGesture()
  wheel(viewport, { deltaY: 2, deltaMode: 1 })
  assert.equal(labelTop, 192, "Line-based mouse wheels use pixel-normalized offsets")
  finishGesture()
  wheel(viewport, { deltaY: 1, deltaMode: 2 })
  assert.equal(labelTop, 692, "Page-based scrolling respects viewport height")
  wheel(viewport, { deltaY: 1000 })
  assert.equal(labelTop, 700, "Scrolling stops at the final row")
  finishGesture()
  const beforeZoom = updates
  assert.equal(wheel(viewport, { deltaY: 100, ctrlKey: true }).defaultPrevented, false, "Browser zoom stays native")
  assert.equal(updates, beforeZoom)
  stop()
  wheel(viewport, { deltaX: 20 })
  wheel(track, { deltaY: 20 })
  assert.equal(updates, beforeZoom, "Unmounting removes both viewport and companion wheel listeners")
  console.info("PASS synchronous wheel and label updates, axis locking, companion tracks, wheel units, bounds, zoom and cleanup")
} finally {
  stop()
  mock.timers.reset()
}
