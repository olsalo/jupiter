import assert from "node:assert/strict"
import { mock } from "node:test"
import { createElement, type ComponentProps, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createServer } from "vite"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"

import type { CalendarDragSelection } from "../app/lib/calendar/types"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/calendar-new-booking-drag",
  appType: "custom",
  resolve: { alias: { "~": appPath, "@coss/ui/lib": `${appPath}/lib` } },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
})

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")

try {
  const i18n = createInstance()
  await i18n.init({ lng: "en", fallbackLng: "en", resources: { en: { translation: {} } } })
  const { getCalendarTimelineLayout } = await vite.ssrLoadModule("/app/lib/calendar/timeline-layout.ts") as typeof import("../app/lib/calendar/timeline-layout")
  const { CalendarDragLane } = await vite.ssrLoadModule("/app/components/calendar/calendar-drag-selection.tsx") as typeof import("../app/components/calendar/calendar-drag-selection")
  const { bookingDuration } = await vite.ssrLoadModule("/app/lib/schemas/appointments.ts") as typeof import("../app/lib/schemas/appointments")
  assert.equal(bookingDuration.safeParse(15).success, true, "Booking mutations accept a fifteen-minute drag duration")
  assert.equal(bookingDuration.safeParse(14).success, false, "Booking mutations reject durations below the grid interval")
  mock.timers.enable({ apis: ["Date", "setTimeout"], now: +new Date("2026-10-19T09:43:25Z") })
  let finePointer = true
  Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia: () => ({ matches: finePointer }) } })

  function harness(day = "2026-10-19", horizontal = false, minDurationMinutes?: number, intervalMinutes?: number, serviceDurations?: readonly number[], blocked: { startMinute: number; endMinute: number }[] = [], { mobile = false, canSelect = true, pointerType = "mouse" } = {}) {
    const selections: CalendarDragSelection[] = []
    const previews: CalendarDragSelection[] = []
    const dragging: boolean[] = []
    let starts = 0
    let lane!: ReactElement<ComponentProps<"div">>
    function Capture() {
      lane = CalendarDragLane({
        serviceDurations, minDurationMinutes, intervalMinutes, horizontal, mobile, day: new Date(`${day}T00:00:00Z`), timeZone: "UTC", member: { id: "alice", name: "Alice" },
        startMinute: 540, endMinute: 1020, blocked, formatPreference: "eu", children: null,
        onSelect: canSelect ? (selection) => selections.push(selection) : undefined, onSelectUpdate: (selection) => previews.push(selection),
        onSelectStart: () => { starts += 1 }, onDraggingChange: (value) => dragging.push(value),
      })
      return null
    }
    renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(Capture)))
    const element = { style: { cursor: "" }, getBoundingClientRect: () => ({ left: 100, width: 960, top: 0, height: 480 }), setPointerCapture: () => {} }
    const event = (minute: number) => ({ currentTarget: element, target: { closest: () => null }, pointerId: 1, pointerType, button: 0, clientX: 100 + (minute - 540) * 2, clientY: minute - 540, preventDefault: () => {} }) as unknown as Parameters<NonNullable<typeof lane.props.onPointerDown>>[0]
    return { selections, previews, dragging, get starts() { return starts }, get cursor() { return element.style.cursor }, enter: (minute: number) => lane.props.onPointerEnter?.(event(minute)), leave: () => lane.props.onPointerLeave?.(event(600)), down: (minute: number) => lane.props.onPointerDown?.(event(minute)), move: (minute: number) => lane.props.onPointerMove?.(event(minute)), release: (minute: number) => lane.props.onPointerUp?.(event(minute)), lostCapture: () => lane.props.onLostPointerCapture?.(event(600)), up: (minute: number) => { lane.props.onPointerUp?.(event(minute)); mock.timers.tick(0) } }
  }

  for (const horizontal of [false, true]) {
    const cursor = harness("2026-10-19", horizontal, undefined, undefined, undefined, [{ startMinute: 660, endMinute: 720 }])
    cursor.enter(600)
    assert.equal(cursor.cursor, "crosshair", "Free time offers drag selection on pointer enter")
    cursor.move(680)
    assert.equal(cursor.cursor, "default", "Occupied time uses the default cursor")
    cursor.move(530)
    assert.equal(cursor.cursor, "default", "Time outside the lane uses the default cursor")
    cursor.move(600)
    assert.equal(cursor.cursor, "crosshair", "Moving back to free time restores the crosshair")
    cursor.leave()
    assert.equal(cursor.cursor, "default", "Leaving the lane clears the crosshair")
  }
  for (const options of [{ mobile: true }, { canSelect: false }, { pointerType: "touch" }]) {
    const cursor = harness("2026-10-19", false, undefined, undefined, undefined, [], options)
    cursor.enter(600)
    assert.equal(cursor.cursor, "default", "Mobile, touch and non-selectable lanes use the default cursor")
  }
  finePointer = false
  const coarse = harness()
  coarse.enter(600)
  assert.equal(coarse.cursor, "default", "Devices without a fine hovering pointer use the default cursor")
  finePointer = true

  const rows = harness("2026-10-19", true)
  rows.down(600)
  rows.move(645)
  rows.up(645)
  assert.equal(rows.selections.at(-1)?.startMinute, 600, "Horizontal selection converts x coordinates into start time")
  assert.equal(rows.selections.at(-1)?.endMinute, 645, "Horizontal selection uses the lane width")
  const reverseRows = harness("2026-10-19", true)
  reverseRows.down(645)
  reverseRows.up(600)
  assert.equal(reverseRows.selections.at(-1)?.startMinute, 600, "Rows support dragging backwards to select a range")
  assert.equal(reverseRows.selections.at(-1)?.endMinute, 660)

  const quickRelease = harness()
  quickRelease.down(600)
  quickRelease.release(630)
  assert.equal(quickRelease.selections.length, 0, "The booking panel stays closed during the releasing pointer event")
  quickRelease.lostCapture()
  mock.timers.tick(0)
  assert.equal(quickRelease.selections.length, 1, "A quick release commits after the gesture even when capture is lost before opening")
  assert.equal(quickRelease.selections[0].endMinute, 630)

  const interrupted = harness()
  interrupted.down(600)
  interrupted.move(630)
  interrupted.lostCapture()
  interrupted.up(630)
  assert.equal(interrupted.selections.length, 0, "Capture lost before release cancels an unfinished gesture")

  const backwards = harness()
  backwards.down(600)
  backwards.move(550)
  assert.equal(backwards.previews.at(-1)?.startMinute, 540, "A drag started in the future can extend into past time")
  backwards.up(550)
  assert.equal(backwards.selections.at(-1)?.startMinute, 540, "Releasing in the past preserves the selected start")

  const nearNow = harness()
  nearNow.down(584)
  nearNow.up(600)
  assert.equal(nearNow.selections.length, 1, "A first quick drag just ahead of now is accepted even when rounding down would land in the past")
  assert.equal(nearNow.selections[0].startMinute, 570)
  assert.equal(nearNow.starts, 1, "A quick release without pointer-move events starts the flow once")

  const returnedToAnchor = harness()
  returnedToAnchor.down(600)
  returnedToAnchor.move(610)
  returnedToAnchor.up(601)
  assert.equal(returnedToAnchor.selections.length, 1, "An established drag is not discarded when a quick release ends close to its anchor")
  assert.equal(returnedToAnchor.selections[0].endMinute - returnedToAnchor.selections[0].startMinute, 15)
  assert.equal(returnedToAnchor.starts, 1)
  assert.deepEqual(returnedToAnchor.dragging, [true, false])

  const past = harness()
  past.down(580)
  past.up(600)
  assert.equal(past.selections.length, 1, "Starting in the past creates a booking draft")
  const pastDate = harness("2026-10-12")
  pastDate.down(600)
  pastDate.up(630)
  assert.equal(pastDate.selections[0].day, "2026-10-12", "Past dates allow creating a booking draft")
  const customMinimum = harness("2026-10-19", false, 30)
  customMinimum.down(600)
  customMinimum.up(610)
  assert.equal(customMinimum.selections[0].endMinute - customMinimum.selections[0].startMinute, 30, "The lane prop controls the minimum selected duration")
  const customStep = harness("2026-10-19", false, 15, 5)
  customStep.down(605)
  customStep.up(625)
  assert.equal(customStep.selections[0].startMinute, 605, "The lane prop controls the selection interval")
  assert.equal(customStep.selections[0].endMinute, 625)
  for (const horizontal of [false, true]) {
    const smart = harness("2026-10-19", horizontal, undefined, undefined, [20, 30, 50])
    smart.down(600)
    smart.move(620)
    assert.equal(smart.previews.at(-1)?.endMinute, 620, "New booking previews snap to a twenty-minute service")
    smart.up(620)
    assert.equal(smart.selections[0].endMinute - smart.selections[0].startMinute, 20, "New booking drops preserve the smart service duration")
    const longer = harness("2026-10-19", horizontal, undefined, undefined, [20, 30, 50])
    longer.down(600)
    longer.up(668)
    assert.equal(longer.selections[0].endMinute, 665, "Selections beyond the longest service use fifteen-minute steps")
    const reverse = harness("2026-10-19", horizontal, undefined, undefined, [20, 30, 50])
    reverse.down(630)
    reverse.up(625)
    assert.equal(reverse.selections[0].endMinute - reverse.selections[0].startMinute, 20, "Backward selection uses the same service duration stops")
  }
  for (const horizontal of [false, true]) {
    const bookings = [
      { id: "before", day: "2026-10-19", memberId: "alice", customerName: "Previous", startMinute: 590, endMinute: 610, bufferAfterMinutes: 10, status: "CONFIRMED", service: { id: "service", name: "Service", color: "#0088ff" } },
      { id: "after", day: "2026-10-19", memberId: "alice", customerName: "Next", startMinute: 668, endMinute: 700, bufferBeforeMinutes: 5, status: "CONFIRMED", service: { id: "service", name: "Service", color: "#0088ff" } },
    ]
    const layout = getCalendarTimelineLayout({ days: [new Date("2026-10-19T00:00:00Z")], members: [{ id: "alice", name: "Alice" }], appointments: bookings, conflictAppointments: bookings, unavailableDays: [], unavailableTimes: [], startMinute: 540, endMinute: 1020, allowSimultaneousBookings: false, excludeDraftConflicts: true })
    const bounds = layout[0].lanes[0].blocked
    assert.deepEqual(bounds.map(({ startMinute, endMinute }) => ({ startMinute, endMinute })), [{ startMinute: 590, endMinute: 620 }, { startMinute: 663, endMinute: 700 }], "Initial drag boundaries include existing service buffers")
    const initialSnap = harness("2026-10-19", horizontal, undefined, undefined, [20, 30, 50], bounds)
    initialSnap.down(622)
    initialSnap.move(661)
    assert.equal(initialSnap.previews.at(-1)?.startMinute, 620, "The initial drag snaps to the exact end of the preceding booking")
    assert.equal(initialSnap.previews.at(-1)?.endMinute, 663, "The initial drag fills the gap to an off-grid next booking")
    initialSnap.up(661)
    assert.equal(initialSnap.selections[0].endMinute, 663, "The drop preserves the live snapped boundary")
    const backwardsSnap = harness("2026-10-19", horizontal, undefined, undefined, [20, 30, 50], bounds)
    backwardsSnap.down(645)
    backwardsSnap.up(621)
    assert.equal(backwardsSnap.selections[0].startMinute, 620, "A backwards initial drag can fill the same off-grid gap")
    const narrow = harness("2026-10-19", horizontal, undefined, undefined, [20, 30], [{ startMinute: 590, endMinute: 620 }, { startMinute: 637, endMinute: 700 }])
    narrow.down(622)
    narrow.up(636)
    assert.equal(narrow.selections[0].startMinute, 620)
    assert.equal(narrow.selections[0].endMinute, 637, "A usable gap is not lost by rounding both boundaries to the grid")
    const tooShort = harness("2026-10-19", horizontal, undefined, undefined, [20, 30], [{ startMinute: 590, endMinute: 620 }, { startMinute: 630, endMinute: 700 }])
    tooShort.down(622)
    tooShort.up(628)
    assert.equal(tooShort.selections.length, 0, "Snapping never permits a booking below fifteen minutes")
    const occupied = harness("2026-10-19", horizontal, undefined, undefined, [20, 30], bounds)
    occupied.down(610)
    occupied.up(650)
    assert.equal(occupied.selections.length, 0, "An initial drag cannot start inside an occupied booking")
  }
  const click = harness()
  click.down(600)
  click.up(600)
  assert.equal(click.selections.length, 0, "A plain click does not create a booking")

  console.info("PASS pointer cursor states, past-time selection, first quick drag near now, release without pointer moves, minimum duration and plain clicks")
} finally {
  mock.timers.reset()
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow)
  else Reflect.deleteProperty(globalThis, "window")
  await vite.close()
}
