import type { CalendarDragSelection } from "../app/lib/calendar/types"
import assert from "node:assert/strict"
import { mock } from "node:test"
import { createElement, type PointerEvent } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"

import type { CalendarBookingDragPhase } from "../app/lib/calendar/booking-drag"

const vite = await createServer({
  configFile: false,
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
})
const originalGlobals = new Map(["window", "requestAnimationFrame", "cancelAnimationFrame"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
const frames = new Map<number, FrameRequestCallback>()
let frameId = 0
Object.defineProperty(globalThis, "requestAnimationFrame", { configurable: true, value: (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId } })
Object.defineProperty(globalThis, "cancelAnimationFrame", { configurable: true, value: (id: number) => frames.delete(id) })
Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia: () => ({ matches: true }) } })
const frame = () => {
  const callbacks = [...frames.values()]
  frames.clear()
  for (const callback of callbacks) callback(16)
}

try {
  const { useCalendarBookingDrag } = await vite.ssrLoadModule("/app/components/calendar/use-calendar-booking-drag.ts") as typeof import("../app/components/calendar/use-calendar-booking-drag")
  mock.timers.enable({ apis: ["Date", "setTimeout"], now: Date.parse("2026-10-19T09:00:00Z") })
  const { getCalendarPreviewIssues, getCalendarAppointmentPosition } = await vite.ssrLoadModule("/app/lib/calendar/preview-issues.ts") as typeof import("../app/lib/calendar/preview-issues")
  const { createCalendarBookingDragPreview } = await vite.ssrLoadModule("/app/lib/calendar/booking-drag-preview.ts") as typeof import("../app/lib/calendar/booking-drag-preview")
  function harness(resize = false, creationDraft = false, horizontal = false, liveIssues = false, bufferedNeighbour = false, serviceDurations?: readonly number[], appointmentStart = 600) {
    const bounds = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height })
    const measurements = { lanes: 0, queries: 0 }
    const sharedPreview = createCalendarBookingDragPreview()
    const members = [{ id: "alice", name: "Alice" }, { id: "bob", name: "Bob" }]
    const lanes = members.map((member, index) => ({ dataset: { day: creationDraft && index === 1 ? "2099-10-29" : "2099-10-28", memberId: creationDraft ? members[0].id : member.id }, getBoundingClientRect: () => { measurements.lanes += 1; return horizontal ? bounds(100 - viewport.scrollLeft, index * 100 - viewport.scrollTop, 600, 100) : bounds(100 + index * 200 - viewport.scrollLeft, -viewport.scrollTop, 200, 600) } }))
    const card = { dataset: { appointmentId: "booking" }, getBoundingClientRect: () => horizontal ? bounds(100 + appointmentStart - 540 + 2, 4, 56, 92) : bounds(104, appointmentStart - 540, 192, 56), closest: () => lanes[0] }
    const target = { closest: (selector: string) => selector.includes("resize-handle") ? resize ? {} : null : card }
    const grid = { style: { cursor: "" }, querySelectorAll: () => { measurements.queries += 1; return lanes }, setPointerCapture: () => {} }
    const viewport = { getBoundingClientRect: () => bounds(100, 0, viewport.clientWidth, viewport.clientHeight), scrollLeft: 0, scrollTop: 0, scrollWidth: horizontal ? 600 : 400, clientWidth: horizontal ? 600 : 400, scrollHeight: horizontal ? 400 : 600, clientHeight: horizontal ? 400 : 600 }
    const updates: { phase: CalendarBookingDragPhase; selection: CalendarDragSelection }[] = []
    let drag!: ReturnType<typeof useCalendarBookingDrag>
    function Capture() {
      drag = useCalendarBookingDrag({
        appointments: [{ id: "booking", day: "2099-10-28", memberId: "alice", customerName: "Aino", startMinute: appointmentStart, endMinute: appointmentStart + 60, durationMinutes: 60, bufferBeforeMinutes: bufferedNeighbour ? 5 : 0, bufferAfterMinutes: bufferedNeighbour ? 10 : 0, movable: true, status: creationDraft ? "" : "CONFIRMED", draft: creationDraft, creationDraft, service: { id: "service", name: "Consultation", color: "#808080" } }],
        conflictAppointments: bufferedNeighbour ? [{ id: "neighbour", day: "2099-10-28", memberId: "alice", customerName: "Next", startMinute: 700, endMinute: 720, bufferBeforeMinutes: 5, bufferAfterMinutes: 10, status: "CONFIRMED", service: { id: "service", name: "Short service", color: "#808080" } }] : undefined,
        getDraftService: (length) => length === 20 ? { id: "short", name: "Short service", color: "#ff9900" }
          : length === 30 ? { id: "regular", name: "Regular service", color: "#0088ff" } : undefined,
        serviceDurations, liveDragPreview: sharedPreview,
        getBookingIssues: liveIssues ? (candidate) => getCalendarPreviewIssues(getCalendarAppointmentPosition(candidate, "UTC"), {
          rules: [
            { staffMemberId: null, windows: [{ start: Date.parse("2099-10-28T09:00:00Z"), end: Date.parse("2099-10-28T19:00:00Z") }] },
            { staffMemberId: "alice", isBreak: true, windows: [{ start: Date.parse(resize ? "2099-10-28T11:10:00Z" : "2099-10-28T10:10:00Z"), end: Date.parse(resize ? "2099-10-28T11:20:00Z" : "2099-10-28T10:20:00Z") }] },
          ], timeZone: "UTC", defaultStartMinute: 540, defaultEndMinute: 1140, now: Date.now(),
        }) : undefined,
        horizontal, members, unavailableTimes: [], startMinute: 540, endMinute: 1140, timeZone: "UTC", allowSimultaneousBookings: false,
        viewportRef: { current: viewport as unknown as HTMLDivElement }, scrollTo: () => {},
        onMove: (_, selection, phase) => { updates.push({ phase, selection }) },
      })
      return null
    }
    // The handlers and external preview store can be exercised without mounting a browser DOM
    renderToStaticMarkup(createElement(Capture))
    const event = (x: number, y: number) => ({ currentTarget: grid, target, pointerId: 1, pointerType: "mouse", button: 0, clientX: x, clientY: y, preventDefault: () => {} }) as unknown as PointerEvent<HTMLDivElement>
    return { drag, sharedPreview, updates, event, viewport, measurements, lanes, grid }
  }

  for (const horizontal of [false, true]) {
    const live = harness(false, false, horizontal, true)
    assert.equal(live.drag.dragPreview, live.sharedPreview, "The overlay and issue panel share the pointer preview store")
    live.drag.gridProps.onPointerDown(live.event(horizontal ? 170 : 150, horizontal ? 30 : 80))
    live.drag.gridProps.onPointerMove(live.event(horizontal ? 180 : 150, horizontal ? 30 : 90))
    assert.deepEqual(live.sharedPreview.getSnapshot()?.appointment.availabilityIssues, ["overlapsBreak"], "The live warning detects the current position before panel form updates")
    live.drag.gridProps.onPointerMove(live.event(horizontal ? 180 : 350, horizontal ? 140 : 90))
    frame()
    assert.equal(live.sharedPreview.getSnapshot()?.appointment.memberId, "bob")
    assert.deepEqual(live.sharedPreview.getSnapshot()?.appointment.availabilityIssues, [], "Moving to another member clears the original member's break warning immediately")
    live.drag.gridProps.onPointerCancel()
    assert.equal(live.sharedPreview.getSnapshot()?.appointment.memberId, "alice", "Cancel returns the warning to the original position")
  }
  for (const horizontal of [false, true]) {
    const adjacent = harness(false, false, horizontal, false, true)
    adjacent.drag.gridProps.onPointerDown(adjacent.event(horizontal ? 180 : 150, horizontal ? 30 : 80))
    adjacent.drag.gridProps.onPointerUp(adjacent.event(horizontal ? 314 : 150, horizontal ? 30 : 214))
    assert.equal(adjacent.updates.at(-1)?.selection.startMinute, 735, "Drag starts after the neighbour's cleanup buffer and the moving service's preparation buffer")
    assert.equal(adjacent.updates.at(-1)?.selection.endMinute, 795, "Adjacent moves preserve the full booking length")
    const resize = harness(true, false, horizontal, false, true)
    resize.drag.gridProps.onPointerDown(resize.event(horizontal ? 214 : 150, horizontal ? 30 : 114))
    resize.drag.gridProps.onPointerUp(resize.event(horizontal ? 250 : 150, horizontal ? 30 : 150))
    assert.equal(resize.updates.at(-1)?.selection.endMinute, 685, "Resize fills the gap while preserving both bookings' buffers")
  }

  for (const horizontal of [false, true]) {
    const smart = harness(true, false, horizontal, false, false, [20, 30, 50])
    smart.drag.gridProps.onPointerDown(smart.event(horizontal ? 214 : 150, horizontal ? 30 : 114))
    smart.drag.gridProps.onPointerMove(smart.event(horizontal ? 174 : 150, horizontal ? 30 : 74))
    assert.equal(smart.sharedPreview.getSnapshot()?.appointment.endMinute, 620, "Live resizing snaps to another service's twenty-minute duration")
    smart.drag.gridProps.onPointerUp(smart.event(horizontal ? 174 : 150, horizontal ? 30 : 74))
    assert.equal(smart.updates.at(-1)?.selection.endMinute, 620, "Releasing keeps the service duration in both calendar layouts")
  }
  for (const horizontal of [false, true]) {
    const styled = harness(true, true, horizontal, false, false, [20, 30, 50])
    styled.drag.gridProps.onPointerDown(styled.event(horizontal ? 214 : 150, horizontal ? 30 : 114))
    styled.drag.gridProps.onPointerMove(styled.event(horizontal ? 174 : 150, horizontal ? 30 : 74))
    assert.deepEqual(styled.sharedPreview.getSnapshot()?.appointment.service, { id: "short", name: "Short service", color: "#ff9900" }, "The floating draft changes service name and colour on the first resize movement")
    assert.equal(styled.updates.length, 1, "Live styling does not wait for a panel update or pointer release")
    styled.drag.gridProps.onPointerMove(styled.event(horizontal ? 184 : 150, horizontal ? 30 : 84))
    frame()
    assert.equal(styled.sharedPreview.getSnapshot()?.appointment.service.color, "#0088ff", "Crossing another service length updates the card during the same drag")
    styled.drag.gridProps.onPointerCancel()
    assert.equal(styled.sharedPreview.getSnapshot()?.appointment.service.id, "service", "Cancelling restores the original card style")
    const custom = harness(true, true, horizontal, false, false, [20, 30, 50])
    custom.drag.gridProps.onPointerDown(custom.event(horizontal ? 214 : 150, horizontal ? 30 : 114))
    custom.drag.gridProps.onPointerMove(custom.event(horizontal ? 199 : 150, horizontal ? 30 : 99))
    assert.deepEqual(custom.sharedPreview.getSnapshot()?.appointment.service, { id: "", name: "", color: "#808080" }, "Unmatched draft lengths immediately use the neutral style")
    custom.drag.gridProps.onPointerCancel()
    const saved = harness(true, false, horizontal, false, false, [20, 30, 50])
    saved.drag.gridProps.onPointerDown(saved.event(horizontal ? 214 : 150, horizontal ? 30 : 114))
    saved.drag.gridProps.onPointerMove(saved.event(horizontal ? 174 : 150, horizontal ? 30 : 74))
    assert.equal(saved.sharedPreview.getSnapshot()?.appointment.service.id, "service", "Resizing an existing booking retains its selected service")
    saved.drag.gridProps.onPointerCancel()
  }

  for (const horizontal of [false, true]) {
    const offGrid = harness(false, false, horizontal, false, false, undefined, 605)
    offGrid.drag.gridProps.onPointerDown(offGrid.event(horizontal ? 185 : 150, horizontal ? 30 : 85))
    offGrid.drag.gridProps.onPointerUp(offGrid.event(horizontal ? 185 : 350, horizontal ? 140 : 85))
    assert.equal(offGrid.updates.at(-1)?.selection.startMinute, 605, "Moving an existing off-grid booking between members preserves its exact start")
    assert.equal(offGrid.updates.at(-1)?.selection.member.id, "bob", "Cross-member dragging remains an explicit way to reassign a booking")
    const shorter = harness(true, false, horizontal, false, false, undefined, 605)
    shorter.drag.gridProps.onPointerDown(shorter.event(horizontal ? 219 : 150, horizontal ? 30 : 119))
    shorter.drag.gridProps.onPointerUp(shorter.event(horizontal ? 189 : 350, horizontal ? 140 : 89))
    assert.equal(shorter.updates.at(-1)?.selection.startMinute, 605, "Shortening leaves the off-grid start fixed")
    assert.equal(shorter.updates.at(-1)?.selection.member.id, "alice", "Shortening cannot move the booking to a neighbouring member lane")
  }

  const liveResize = harness(true, false, false, true)
  liveResize.drag.gridProps.onPointerDown(liveResize.event(150, 112))
  liveResize.drag.gridProps.onPointerMove(liveResize.event(150, 118))
  assert.deepEqual(liveResize.sharedPreview.getSnapshot()?.appointment.availabilityIssues, [], "A short resize stays before the break")
  liveResize.drag.gridProps.onPointerMove(liveResize.event(150, 150))
  frame()
  assert.deepEqual(liveResize.sharedPreview.getSnapshot()?.appointment.availabilityIssues, ["overlapsBreak"], "Resizing into a break updates the floating warning immediately")
  liveResize.drag.gridProps.onPointerCancel()
  const moving = harness()
  moving.drag.gridProps.onPointerDown(moving.event(150, 80))
  assert.equal(moving.grid.style.cursor, "grabbing", "The capture target has a grabbing cursor before movement starts")
  moving.drag.gridProps.onPointerMove(moving.event(150, 90))
  assert.equal(moving.updates[0].phase, "start")
  assert.equal(moving.updates.length, 1, "Moving the block does not immediately rebuild the panel")
  assert.equal(moving.drag.dragPreview.getSnapshot()?.appointment.startMinute, 610, "The floating block updates immediately before the panel")
  moving.drag.gridProps.onPointerMove(moving.event(350, 120))
  frame()
  assert.equal(moving.drag.dragPreview.getSnapshot()?.appointment.memberId, "bob", "The floating block follows the pointer immediately")
  assert.equal(moving.updates.at(-1)?.selection.member.id, "alice", "A rapid move does not synchronously rebuild the live panel")
  mock.timers.tick(120)
  assert.equal(moving.updates.at(-1)?.selection.member.id, "bob", "The panel follows the live member")
  assert.equal(moving.updates.at(-1)?.selection.startMinute, 640)
  const updateCount = moving.updates.length
  moving.drag.gridProps.onPointerMove(moving.event(350, 121))
  frame()
  assert.equal(moving.updates.length, updateCount, "Sub-slot pointer movement does not rerender the panel")
  const liveSelection = moving.drag.dragPreview.getSnapshot()?.appointment
  moving.drag.gridProps.onPointerUp(moving.event(350, 121))
  assert.equal(moving.updates.at(-1)?.phase, "drop")
  assert.equal(moving.grid.style.cursor, "", "Dropping restores the original grid cursor")
  assert.equal(moving.updates.at(-1)?.selection.startMinute, liveSelection?.startMinute, "The drop keeps the latest minute-precise overlay time")

  const newBooking = harness(false, true)
  newBooking.drag.gridProps.onPointerDown(newBooking.event(150, 80))
  newBooking.drag.gridProps.onPointerMove(newBooking.event(150, 90))
  newBooking.drag.gridProps.onPointerMove(newBooking.event(350, 120))
  newBooking.drag.gridProps.onPointerUp(newBooking.event(350, 120))
  assert.equal(newBooking.updates.at(-1)?.phase, "drop")
  assert.equal(newBooking.updates.at(-1)?.selection.day, "2099-10-29", "A new booking drops on the target date even before the next animation frame")
  assert.equal(newBooking.updates.at(-1)?.selection.member.id, "alice", "Moving dates keeps the chosen team member")
  const updatesAfterDateDrop = newBooking.updates.length
  mock.timers.tick(200)
  assert.equal(newBooking.updates.length, updatesAfterDateDrop, "A delayed panel update cannot move the new booking back to its original date")

  const quickNewBooking = harness(false, true)
  quickNewBooking.drag.gridProps.onPointerDown(quickNewBooking.event(150, 80))
  quickNewBooking.drag.gridProps.onPointerUp(quickNewBooking.event(350, 120))
  assert.equal(quickNewBooking.updates.at(-1)?.phase, "drop", "A quick draft drag is recognised even without a pointer-move event")
  assert.equal(quickNewBooking.updates.at(-1)?.selection.day, "2099-10-29")

  mock.timers.setTime(Date.parse("2099-10-28T09:43:25Z"))
  const pastTime = harness(false, true)
  pastTime.drag.gridProps.onPointerDown(pastTime.event(150, 80))
  pastTime.drag.gridProps.onPointerMove(pastTime.event(150, 30))
  const movingDraft = pastTime.drag.dragPreview.getSnapshot()
  assert.equal(movingDraft?.appointment.startMinute, 555, "Moving an existing draft is not clamped to the future selection boundary")
  assert.equal(movingDraft?.top, 10, "The floating block follows the pointer when moving into the past")
  mock.timers.tick(120)
  assert.equal(pastTime.updates.at(-1)?.selection.startMinute, 555, "The panel follows the moved draft without the creation-only clamp")
  pastTime.drag.gridProps.onPointerUp(pastTime.event(150, 30))
  assert.equal(pastTime.updates.at(-1)?.phase, "drop", "Past-time drops preserve the draft for save confirmation")
  const pastDate = harness(false, true)
  pastDate.lanes[1].dataset.day = "2099-10-27"
  pastDate.drag.gridProps.onPointerDown(pastDate.event(150, 80))
  pastDate.drag.gridProps.onPointerMove(pastDate.event(150, 90))
  pastDate.drag.gridProps.onPointerMove(pastDate.event(350, 120))
  frame()
  assert.equal(pastDate.drag.dragPreview.getSnapshot()?.appointment.day, "2099-10-27", "An existing draft can move visually into a previous date")
  assert.ok((pastDate.drag.dragPreview.getSnapshot()?.left ?? 0) >= 300, "The floating block follows the pointer into the target date")
  mock.timers.tick(120)
  assert.equal(pastDate.updates.at(-1)?.selection.day, "2099-10-27", "The panel follows the draft across dates without a creation-only clamp")
  pastDate.drag.gridProps.onPointerUp(pastDate.event(350, 120))
  assert.equal(pastDate.updates.at(-1)?.phase, "drop", "Dropping onto a past date keeps the selected date")
  mock.timers.setTime(Date.parse("2099-10-30T12:00:00Z"))
  const pastSavedBooking = harness()
  pastSavedBooking.drag.gridProps.onPointerDown(pastSavedBooking.event(150, 80))
  pastSavedBooking.drag.gridProps.onPointerUp(pastSavedBooking.event(150, 30))
  assert.equal(pastSavedBooking.updates.at(-1)?.phase, "drop", "Saved bookings can be moved into past time")
  const pastResize = harness(true)
  pastResize.drag.gridProps.onPointerDown(pastResize.event(150, 114))
  pastResize.drag.gridProps.onPointerUp(pastResize.event(150, 144))
  assert.equal(pastResize.updates.at(-1)?.phase, "drop", "Bookings on past dates can be resized")
  mock.timers.setTime(Date.parse("2026-10-19T09:00:00Z"))

  const resizing = harness(true)
  resizing.drag.gridProps.onPointerDown(resizing.event(150, 114))
  assert.equal(resizing.grid.style.cursor, "ns-resize", "The resize cursor is applied before pointer capture")
  resizing.drag.gridProps.onPointerMove(resizing.event(150, 144))
  assert.equal(resizing.drag.dragPreview.getSnapshot()?.appointment.endMinute, 690, "The resized block updates before the panel")
  mock.timers.tick(120)
  assert.equal(resizing.updates.at(-1)?.phase, "move")
  assert.equal(resizing.updates.at(-1)?.selection.startMinute, 600)
  assert.equal(resizing.updates.at(-1)?.selection.endMinute, 690, "The panel receives the resized duration before release")
  resizing.drag.gridProps.onPointerUp(resizing.event(150, 144))

  const shortResize = harness(true)
  shortResize.drag.gridProps.onPointerDown(shortResize.event(150, 114))
  shortResize.drag.gridProps.onPointerUp(shortResize.event(150, 64))
  assert.equal(shortResize.updates.at(-1)?.phase, "drop")
  assert.equal(shortResize.updates.at(-1)?.selection.endMinute, 615, "A saved sixty-minute booking can be dragged down to fifteen minutes")

  const quickResize = harness(true)
  quickResize.drag.gridProps.onPointerDown(quickResize.event(150, 114))
  quickResize.drag.gridProps.onPointerUp(quickResize.event(150, 144))
  assert.equal(quickResize.updates.at(-1)?.phase, "drop", "A quick resize works without an intermediate pointer-move event")
  assert.equal(quickResize.updates.at(-1)?.selection.endMinute, 690)

  const finalResize = harness(true)
  finalResize.drag.gridProps.onPointerDown(finalResize.event(150, 114))
  finalResize.drag.gridProps.onPointerMove(finalResize.event(150, 144))
  finalResize.drag.gridProps.onPointerMove(finalResize.event(150, 174))
  finalResize.drag.gridProps.onPointerUp(finalResize.event(150, 174))
  assert.equal(finalResize.updates.at(-1)?.selection.endMinute, 720, "A resize release commits the final length before the next animation frame")

  const retryResize = harness(true)
  retryResize.drag.gridProps.onPointerDown(retryResize.event(150, 114))
  retryResize.drag.gridProps.onPointerMove(retryResize.event(150, 144))
  retryResize.drag.gridProps.onPointerCancel()
  assert.equal(retryResize.grid.style.cursor, "", "Cancelling restores the grid cursor")
  retryResize.drag.gridProps.onPointerDown(retryResize.event(150, 114))
  retryResize.drag.gridProps.onPointerUp(retryResize.event(150, 174))
  assert.equal(retryResize.updates.at(-1)?.phase, "drop", "A quick resize can interrupt the previous return animation")
  assert.equal(retryResize.updates.at(-1)?.selection.endMinute, 720)
  const updatesAfterRetry = retryResize.updates.length
  mock.timers.tick(500)
  assert.equal(retryResize.updates.length, updatesAfterRetry, "The cancelled return timer cannot overwrite a new resize")

  const rapid = harness()
  let overlayFrames = 0
  const unsubscribePreview = rapid.drag.dragPreview.subscribe(() => { overlayFrames += 1 })
  rapid.drag.gridProps.onPointerDown(rapid.event(150, 80))
  rapid.drag.gridProps.onPointerMove(rapid.event(150, 90))
  for (let index = 0; index < 60; index += 1) {
    rapid.drag.gridProps.onPointerMove(rapid.event(index % 2 ? 350 : 150, 100 + index % 30 * 4))
    frame()
    mock.timers.tick(5)
  }
  assert.ok(overlayFrames >= 61, "Every rapid pointer frame still updates the floating block")
  assert.equal(rapid.updates.filter((update) => update.phase === "move").length, 0, "Sixty rapid pointer frames trigger no live form rebuilds")
  assert.equal(rapid.measurements.queries, 1, "Rapid movement queries the lane elements once per drag")
  assert.equal(rapid.measurements.lanes, 3, "The origin and two lanes are measured once instead of on every frame")
  mock.timers.tick(120)
  assert.equal(rapid.updates.at(-1)?.selection.startMinute, rapid.drag.dragPreview.getSnapshot()?.appointment.startMinute, "The panel catches up to the latest position even when the pointer stops")
  rapid.drag.gridProps.onPointerMove(rapid.event(350, 240))
  frame()
  const finalBlock = rapid.drag.dragPreview.getSnapshot()?.appointment
  rapid.drag.gridProps.onPointerUp(rapid.event(350, 240))
  assert.equal(rapid.updates.at(-1)?.phase, "drop")
  assert.equal(rapid.updates.at(-1)?.selection.startMinute, finalBlock?.startMinute, "Dropping commits the displayed block immediately instead of the delayed panel position")
  const updatesAfterDrop = rapid.updates.length
  mock.timers.tick(500)
  assert.equal(rapid.updates.length, updatesAfterDrop, "A queued live update cannot overwrite a drop")
  unsubscribePreview()

  const scrolling = harness()
  scrolling.viewport.scrollHeight = 1200
  scrolling.drag.gridProps.onPointerDown(scrolling.event(150, 80))
  scrolling.drag.gridProps.onPointerMove(scrolling.event(150, 90))
  const measuredBeforeScroll = scrolling.measurements.lanes
  scrolling.viewport.scrollTop = 100
  scrolling.drag.gridProps.onPointerMove(scrolling.event(150, 200))
  frame()
  assert.equal(scrolling.drag.dragPreview.getSnapshot()?.appointment.startMinute, 820, "Cached lane bounds follow vertical scrolling when calculating the time")
  assert.equal(scrolling.measurements.lanes, measuredBeforeScroll, "Scrolling adjusts cached geometry without forcing more lane measurements")
  scrolling.viewport.clientWidth = 320
  scrolling.drag.gridProps.onPointerMove(scrolling.event(150, 210))
  frame()
  assert.equal(scrolling.measurements.lanes, measuredBeforeScroll + 2, "Resizing the viewport invalidates the cache and measures the current lanes again")
  scrolling.drag.gridProps.onPointerUp(scrolling.event(150, 210))

  const horizontal = harness(false, false, true)
  horizontal.drag.gridProps.onPointerDown(horizontal.event(190, 40))
  horizontal.drag.gridProps.onPointerMove(horizontal.event(220, 140))
  assert.equal(horizontal.drag.dragPreview.getSnapshot()?.appointment.memberId, "bob", "Horizontal dragging chooses members by the row")
  assert.equal(horizontal.drag.dragPreview.getSnapshot()?.appointment.startMinute, 630, "Horizontal dragging chooses time by the x coordinate")
  horizontal.drag.gridProps.onPointerUp(horizontal.event(220, 140))
  assert.equal(horizontal.updates.at(-1)?.phase, "drop")
  assert.equal(horizontal.updates.at(-1)?.selection.member.id, "bob")
  assert.equal(horizontal.updates.at(-1)?.selection.startMinute, 630)

  const horizontalResize = harness(true, false, true)
  horizontalResize.drag.gridProps.onPointerDown(horizontalResize.event(216, 40))
  assert.equal(horizontalResize.grid.style.cursor, "ew-resize", "Horizontal bookings resize from their right edge")
  horizontalResize.drag.gridProps.onPointerMove(horizontalResize.event(246, 40))
  assert.equal(horizontalResize.drag.dragPreview.getSnapshot()?.appointment.startMinute, 600)
  assert.equal(horizontalResize.drag.dragPreview.getSnapshot()?.appointment.endMinute, 690)
  assert.equal(horizontalResize.drag.dragPreview.getSnapshot()?.width, 86, "Resizing changes the floating card width")
  horizontalResize.drag.gridProps.onPointerUp(horizontalResize.event(246, 40))
  assert.equal(horizontalResize.updates.at(-1)?.selection.endMinute, 690)
  assert.equal(horizontalResize.updates.at(-1)?.selection.member.id, "alice")

  const cancelled = harness()
  cancelled.drag.gridProps.onPointerDown(cancelled.event(150, 80))
  cancelled.drag.gridProps.onPointerMove(cancelled.event(350, 120))
  cancelled.drag.gridProps.onPointerMove(cancelled.event(150, 170))
  frame()
  cancelled.drag.gridProps.onPointerCancel()
  assert.equal(cancelled.updates.at(-1)?.phase, "cancel")
  assert.equal(cancelled.updates.at(-1)?.selection.member.id, "alice")
  assert.equal(cancelled.updates.at(-1)?.selection.startMinute, 600, "Cancellation restores the panel's starting values")
  const updatesAfterCancel = cancelled.updates.length
  mock.timers.tick(500)
  assert.equal(cancelled.updates.length, updatesAfterCancel, "A queued live update cannot overwrite cancellation")
  assert.equal(frames.size, 0, "Dropping or cancelling stops animation frames")
  console.info("PASS live drag and resize updates, quiet live forms during rapid movement, cached lane measurements, scrolling, stationary catch-up, exact drop and cancellation")
} finally {
  mock.timers.reset()
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
  await vite.close()
}
