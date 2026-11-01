import assert from "node:assert/strict"
import { mock } from "node:test"
import { startCalendarTouchDrag } from "../app/lib/calendar/touch-drag.ts"

class TrackedTarget extends EventTarget {
  listeners = new Set<string>()
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
    this.listeners.add(type)
    super.addEventListener(type, listener, options)
  }
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
    this.listeners.delete(type)
    super.removeEventListener(type, listener, options)
  }
}
function harness() {
  const window = new TrackedTarget()
  const originalTarget = new TrackedTarget()
  const document = Object.assign(new TrackedTarget(), { defaultView: window, hidden: false })
  const element = { ownerDocument: document, isConnected: true } as unknown as HTMLElement
  const phases: string[] = []
  const points: { x: number; y: number }[] = []
  const cleanup = startCalendarTouchDrag({ element, origin: { x: 100, y: 100 }, onActivate: () => phases.push("start"), onMove: (point) => { phases.push("move"); points.push(point) }, onEnd: (point) => { phases.push("drop"); points.push(point) }, onCancel: () => phases.push("cancel") })
  const touch = (type: string, x = 100, y = 100, cancelable = true, identifier = 42, target = document as TrackedTarget) => {
    const event = Object.assign(new Event(type, { cancelable }), {
      touches: type === "touchend" ? [] : [{ identifier, clientX: x, clientY: y }],
      changedTouches: [{ identifier, clientX: x, clientY: y }],
    })
    if (type === "touchstart") Object.defineProperty(event, "target", { configurable: true, value: originalTarget })
    target.dispatchEvent(event)
    return event
  }
  const assertClean = () => {
    assert.equal(document.listeners.size, 0)
    assert.equal(window.listeners.size, 0)
    assert.equal(originalTarget.listeners.size, 0)
  }
  return { window, document, originalTarget, element, phases, points, cleanup, touch, assertClean }
}
mock.timers.enable({ apis: ["setTimeout"] })
try {
  const active = harness()
  active.touch("touchstart")
  mock.timers.tick(449)
  assert.deepEqual(active.phases, [])
  mock.timers.tick(1)
  assert.deepEqual(active.phases, ["start"])
  active.document.dispatchEvent(new Event("pointercancel"))
  active.document.dispatchEvent(new Event("lostpointercapture"))
  assert.equal(active.touch("touchmove", 120, 130).defaultPrevented, true)
  assert.equal(active.touch("touchend", 125, 135).defaultPrevented, true)
  assert.deepEqual(active.phases, ["start", "move", "drop"])
  assert.deepEqual(active.points, [{ x: 120, y: 130 }, { x: 125, y: 135 }])
  active.assertClean()

  const detached = harness()
  detached.touch("touchstart")
  mock.timers.tick(450)
  const move = detached.touch("touchmove", 130, 140)
  detached.originalTarget.dispatchEvent(move)
  assert.deepEqual(detached.phases, ["start", "move"], "A connected target and the document do not process the same move twice")
  assert.equal(detached.touch("touchmove", 150, 160, true, 42, detached.originalTarget).defaultPrevented, true, "A removed card label still prevents native scrolling")
  detached.touch("touchend", 155, 165, true, 42, detached.originalTarget)
  assert.deepEqual(detached.phases, ["start", "move", "move", "drop"], "A gesture finishes after its original label is removed")
  assert.deepEqual(detached.points.at(-1), { x: 155, y: 165 })
  detached.assertClean()

  const tap = harness()
  tap.touch("touchstart")
  assert.equal(tap.touch("touchend").defaultPrevented, false, "A tap retains its normal click")
  mock.timers.tick(500)
  assert.deepEqual(tap.phases, ["cancel"])
  tap.assertClean()

  const swipe = harness()
  swipe.touch("touchstart")
  assert.equal(swipe.touch("touchmove", 110, 100).defaultPrevented, false, "A swipe retains native scrolling")
  mock.timers.tick(500)
  assert.deepEqual(swipe.phases, ["cancel"])
  swipe.assertClean()

  const scrolling = harness()
  scrolling.touch("touchstart")
  scrolling.document.dispatchEvent(new Event("scroll"))
  mock.timers.tick(500)
  assert.deepEqual(scrolling.phases, ["cancel"], "Scrolling during the hold cannot turn into an accidental drag")
  scrolling.assertClean()

  for (const interruption of ["native-scroll", "touchcancel", "multitouch", "blur", "hidden"] as const) {
    const gesture = harness()
    gesture.touch("touchstart")
    mock.timers.tick(450)
    if (interruption === "native-scroll") gesture.touch("touchmove", 120, 130, false)
    if (interruption === "touchcancel") gesture.touch("touchcancel")
    if (interruption === "multitouch") gesture.document.dispatchEvent(Object.assign(new Event("touchstart"), { touches: [{ identifier: 42 }, { identifier: 43 }] }))
    if (interruption === "blur") gesture.window.dispatchEvent(new Event("blur"))
    if (interruption === "hidden") { gesture.document.hidden = true; gesture.document.dispatchEvent(new Event("visibilitychange")) }
    gesture.touch("touchend")
    assert.deepEqual(gesture.phases, ["start", "cancel"], `${interruption} cancels once without committing a booking`)
    gesture.assertClean()
  }

  const edgeScroll = harness()
  edgeScroll.touch("touchstart")
  mock.timers.tick(450)
  edgeScroll.document.dispatchEvent(new Event("scroll"))
  edgeScroll.touch("touchend")
  assert.deepEqual(edgeScroll.phases, ["start", "drop"], "Programmatic edge scrolling does not cancel an active drag")
  edgeScroll.assertClean()

  const removed = harness()
  removed.touch("touchstart")
  Object.assign(removed.element, { isConnected: false })
  mock.timers.tick(450)
  assert.deepEqual(removed.phases, ["cancel"])
  removed.assertClean()

  const unmounted = harness()
  unmounted.touch("touchstart")
  unmounted.cleanup()
  mock.timers.tick(500)
  unmounted.touch("touchmove")
  assert.deepEqual(unmounted.phases, [], "Unmounting clears the hold and all native listeners")
  unmounted.assertClean()
  console.info("PASS touch drag lifecycle, scroll prevention, taps, swipes, pointer cancellation, multitouch, backgrounding, edge scrolling and cleanup")
} finally {
  mock.timers.reset()
}
