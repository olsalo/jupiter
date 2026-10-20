import assert from "node:assert/strict"

import { animateCalendarBookingReturn } from "../app/lib/calendar/booking-return.ts"

const originalCSS = globalThis.CSS
Object.defineProperty(globalThis, "CSS", { configurable: true, value: { escape: (value: string) => value } })
try {
  const appointment = { id: "saved-booking", day: "2026-10-14", memberId: "alice" }
  const from = { left: 800, top: 600, width: 156, height: 92 }
  let savedBounds = { left: 100, top: 200, width: 156, height: 124 }
  let complete = false
  let frames: Keyframe[] | null = null
  let options: number | KeyframeAnimationOptions | undefined
  let finish: (() => void) | undefined
  const element = {
    animate(nextFrames: Keyframe[], nextOptions: KeyframeAnimationOptions) {
      frames = nextFrames
      options = nextOptions
      return { set onfinish(callback: () => void) { finish = callback } } as unknown as Animation
    },
  } as unknown as HTMLElement
  const originalCard = { getBoundingClientRect: () => savedBounds }
  const originalLane = {
    querySelector(selector: string) {
      assert.equal(selector, '[data-appointment-id="saved-booking"]:not([data-draft="true"])', "The moved placeholder cannot be used as the return target")
      return originalCard
    },
  }
  const viewport = {
    getBoundingClientRect: () => ({ left: 100, top: 160, width: 800, height: 600 }),
    querySelector(selector: string) {
      assert.equal(selector, '[data-slot="calendar-member-lane"][data-day="2026-10-14"][data-member-id="alice"]', "Return uses the saved day and member even when the draft was moved elsewhere")
      return originalLane
    },
  } as unknown as HTMLElement
  // The calendar's scroll and width can settle after the edited position was captured
  savedBounds = { left: 120, top: 240, width: 196, height: 124 }
  animateCalendarBookingReturn(element, viewport, appointment, from, () => { complete = true })
  assert.deepEqual(frames, [
    { transform: "translate3d(700px, 440px, 0)", width: "196px", height: "92px" },
    { transform: "translate3d(20px, 80px, 0)", width: "196px", height: "124px" },
  ], "Return positions are relative to the calendar's clipping boundary after the panel closes")
  assert.equal((options as KeyframeAnimationOptions).fill, "forwards", "The card stays at the original position until its overlay is removed")
  assert.equal(complete, false, "The saved card remains hidden until the return finishes")
  finish?.()
  assert.equal(complete, true, "Finishing the animation reveals the saved card")

  savedBounds = { left: 120, top: 240, width: 420, height: 124 }
  animateCalendarBookingReturn(element, viewport, appointment, from, () => {})
  const expandedFrames = frames as Keyframe[] | null
  assert.equal(expandedFrames?.[0]?.width, "420px", "A day-view return starts at the expanded card width immediately after the panel closes")
  assert.equal(expandedFrames?.[1]?.width, "420px", "The return never animates through the old panel-constrained width")

  savedBounds = { left: 60, top: 100, width: 196, height: 124 }
  animateCalendarBookingReturn(element, viewport, appointment, from, () => {})
  assert.equal((frames as Keyframe[] | null)?.[1]?.transform, "translate3d(-40px, -60px, 0)", "Offscreen targets keep their true position so the calendar boundary clips the return instead of exposing it above or beside the grid")

  frames = null
  complete = false
  animateCalendarBookingReturn(element, { querySelector: () => null } as unknown as HTMLElement, appointment, from, () => { complete = true })
  assert.equal(frames, null, "A missing original lane cannot animate toward an unrelated booking or the moved placeholder")
  assert.equal(complete, true, "An unavailable target cleans up its overlay")
  console.info("PASS return animation targets saved booking relative to the calendar boundary, including offscreen targets")
} finally {
  Object.defineProperty(globalThis, "CSS", { configurable: true, value: originalCSS })
}
