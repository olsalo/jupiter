import "dotenv/config"
import assert from "node:assert/strict"
import { mock } from "node:test"
import { createElement } from "react"
import { TZDate } from "react-day-picker"
import { renderToStaticMarkup } from "react-dom/server"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import { createMemoryRouter, Outlet, RouterProvider } from "react-router"
import { createServer } from "vite"
import type { CalendarScheduleRule } from "../app/lib/calendar-schedule"
import type { inferRouterOutputs } from "@trpc/server"
import type { appRouter } from "../app/.server/main"
import type { CalendarBookingPreview } from "../app/components/calendar/calendar-booking-preview"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/week-calendar",
  appType: "custom",
  resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/lib": `${appPath}/lib`, "@coss/ui/components": `${appPath}/components/ui` } },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
})
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })

try {
  const { default: CalendarPage, clientLoader } = await vite.ssrLoadModule("/app/routes/calendar/calendar.tsx")
  const { default: NewBooking } = await vite.ssrLoadModule("/app/routes/calendar/new-appointment.tsx")
  const { default: EditBooking } = await vite.ssrLoadModule("/app/routes/calendar/appointment-edit.tsx")
  const { CalendarBookingPreviewContext } = await vite.ssrLoadModule("/app/components/calendar/calendar-booking-preview.tsx") as typeof import("../app/components/calendar/calendar-booking-preview")
  const { getCalendarBookingDragRange } = await vite.ssrLoadModule("/app/lib/calendar-booking-drag.ts") as typeof import("../app/lib/calendar-booking-drag")
  const { CalendarWeekView } = await vite.ssrLoadModule("/app/components/calendar/calendar-week-view.tsx")
  const { useCalendarState } = await vite.ssrLoadModule("/app/components/calendar/use-calendar-state.ts") as typeof import("../app/components/calendar/use-calendar-state")
  const { CalendarBookingForm } = await vite.ssrLoadModule("/app/components/calendar/calendar-booking-form.tsx")
  const DateSelectedBooking = () => createElement(CalendarBookingForm, { selectedDay: "2026-10-14", onSelectedDayChange: () => {}, onSelectedTimeChange: () => {} })
  const { BookingSlotList, bookingSlotKey } = await vite.ssrLoadModule("/app/components/calendar/booking-slot-list.tsx") as typeof import("../app/components/calendar/booking-slot-list")
  assert.equal(clientLoader(), null, "Client navigation leaves data fetching to TanStack Query")
  const { sortCalendarMembers } = await vite.ssrLoadModule("/app/lib/calendar-schedule.ts") as typeof import("../app/lib/calendar-schedule")
  const { getCalendarAppointments, layoutCalendarAppointments, getCalendarBookingConflicts } = await vite.ssrLoadModule("/app/lib/calendar-appointments.ts") as typeof import("../app/lib/calendar-appointments")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const { TRPCProvider, trpc } = await vite.ssrLoadModule("/app/lib/trpc/client.tsx") as typeof import("../app/lib/trpc/client")
  const { calendarDateFromValue, calendarDateToValue, getCalendarDateState, getCalendarBookingRange } = await vite.ssrLoadModule("/app/lib/calendar-date.ts") as typeof import("../app/lib/calendar-date")
  function PreviewCalendarState() {
    const calendar = useCalendarState()
    const original = useCalendarState({ preview: false })
    return createElement("div", { "data-preview-date": calendarDateToValue(calendar.selected), "data-original-date": calendarDateToValue(original.selected), "data-preview-mode": calendar.mode }, createElement(CalendarWeekView))
  }
  const bookingRange = (search: string, weekStartsOn = 1) => {
    const state = getCalendarDateState(new URLSearchParams(search), { timeZone: "Europe/Helsinki", weekStartsOn })
    const range = getCalendarBookingRange(state, "Europe/Helsinki")
    return [range.from.toISOString(), range.to.toISOString()]
  }
  assert.deepEqual(bookingRange("date=2026-10-14&view=day"), ["2026-10-13T21:00:00.000Z", "2026-10-14T21:00:00.000Z"], "Day bookings cover the selected calendar date in the business timezone")
  assert.deepEqual(bookingRange("date=2026-10-14&view=week"), ["2026-10-11T21:00:00.000Z", "2026-10-18T21:00:00.000Z"], "Week bookings include the entire selected week")
  assert.deepEqual(bookingRange("date=2026-10-14&view=week", 0), ["2026-10-10T21:00:00.000Z", "2026-10-17T21:00:00.000Z"], "Week bookings respect the business week start")
  assert.deepEqual(bookingRange("date=2026-10-25&view=day"), ["2026-10-24T21:00:00.000Z", "2026-10-25T22:00:00.000Z"], "The selected day includes all 25 hours when daylight saving time ends")
  assert.deepEqual(bookingRange("date=2026-10-25&view=week"), ["2026-10-18T21:00:00.000Z", "2026-10-25T22:00:00.000Z"], "Week bookings keep local midnight boundaries across daylight saving changes")
  const options = createTRPCOptionsProxy({ client: trpc, queryClient })
  queryClient.setQueryData([...options.service.list.queryKey()], [{ id: "consultation", name: "Consultation", isActive: true, durationMinutes: 30 }])
  queryClient.setQueryData(options.location.list.queryKey(), [])
  const i18n = createInstance()
  await i18n.init({ resources, lng: "en", fallbackLng: "en", defaultNS: "common", interpolation: { escapeValue: false } })
  const slotFixtures = [
    { startsAt: "2026-10-14T10:00:00.000Z", endsAt: "2026-10-14T10:30:00.000Z", staffMemberId: "alice", locationId: null },
    { startsAt: "2026-10-14T09:00:00.000Z", endsAt: "2026-10-14T09:30:00.000Z", staffMemberId: "bob", locationId: null },
    { startsAt: "2026-10-14T09:00:00.000Z", endsAt: "2026-10-14T09:30:00.000Z", staffMemberId: "alice", locationId: null },
  ]
  const renderSlots = () => renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(BookingSlotList, {
    days: [{ date: "2026-10-14", slots: slotFixtures }],
    members: [{ id: "bob", name: "Bob" }, { id: "alice", name: "Alice" }], locations: [],
    selection: bookingSlotKey(slotFixtures[1]), invalid: false,
    format: (value: string) => value.slice(11, 16), onSelect: () => {},
  })))
  const byTime = renderSlots()
  assert.doesNotMatch(byTime, /data-slot="booking-slot-member"/, "Time grouping shows one list for each date")
  assert.equal((byTime.match(/data-slot="avatar"/g) ?? []).length, 3, "Each time slot shows its member avatar")
  assert.equal((byTime.match(/aria-pressed="(?:true|false)"/g) ?? []).length, 3, "The list retains every slot, including different members at the same time")
  assert.equal((byTime.match(/aria-pressed="true"/g) ?? []).length, 1, "The selected slot stays selected")
  assert.match(byTime, /grid-cols-3/, "Slots use three equal columns")
  assert.equal((byTime.match(/data-slot="tooltip-trigger"/g) ?? []).length, 3, "Every slot has a tooltip trigger")
  assert.doesNotMatch(byTime, /title="/, "Slot labels use tooltips instead of native titles")
  assert.deepEqual([...byTime.matchAll(/aria-label="(Alice|Bob) · (\d\d:\d\d)/g)].map((match) => [match[1], match[2]]), [["Alice", "09:00"], ["Bob", "09:00"], ["Alice", "10:00"]], "Time grouping sorts chronologically and uses stable member order for ties")
  const staff: { id: string; name: string; isActive: boolean; acceptsAppointments: boolean; memberId?: string | null }[] = [
    { id: "alice", name: "Alice", isActive: true, acceptsAppointments: true, memberId: "membership-alice" },
    { id: "bob", name: "Bob", isActive: true, acceptsAppointments: true, memberId: "membership-bob" },
    { id: "inactive", name: "Inactive", isActive: false, acceptsAppointments: true, memberId: "membership-inactive" },
    { id: "admin", name: "Admin", isActive: true, acceptsAppointments: false, memberId: "membership-admin" },
  ]
  const defaults = { timezone: "Europe/Helsinki", weekStartsOn: 0, showWeekends: false, defaultStartHour: 9, defaultEndHour: 17, defaultCalendarView: "week" }
  type Booking = inferRouterOutputs<typeof appRouter>["appointment"]["list"][number]
  const booking: Booking = {
    id: "saved-booking", startsAt: new Date("2026-10-14T05:30:00Z"), endsAt: new Date("2026-10-14T06:30:00Z"),
    status: "CONFIRMED", source: "ADMIN", timezone: "Europe/Helsinki", location: null,
    customer: { id: "aino", firstName: "Aino", lastName: "Virtanen" }, staffMember: { id: "alice", name: "Alice" },
    services: [{ serviceId: "consultation", name: "Booked consultation", durationMinutes: 60, service: { color: "#30968d" } }],
  }
  function render({ url = "/calendar?date=2026-10-14", settings = {}, members = staff, rules = [] as CalendarScheduleRule[], refreshError = false, duringNavigation = false, bookings = [] as Booking[], preview = undefined as CalendarBookingPreview | null | undefined, currentMemberId = undefined as string | undefined, dragSelection = undefined as import("../app/components/calendar/calendar-drag-selection").CalendarDragSelection | undefined, draggedBooking = undefined as (import("../app/components/calendar/calendar-drag-selection").CalendarDragSelection & { appointmentId: string }) | undefined } = {}) {
    queryClient.setQueryData([...options.organizations.getCurrent.queryKey()], { id: "business", memberId: currentMemberId, settings: { ...defaults, ...settings } })
    queryClient.setQueryData([...options.staff.list.queryKey()], members)
    const preferences = { ...defaults, ...settings }
    const params = new URL(url, "https://example.invalid").searchParams
    if (preview) params.set("date", calendarDateToValue(new TZDate(preview.startsAt, preferences.timezone)))
    const state = getCalendarDateState(params, { timeZone: preferences.timezone, weekStartsOn: preferences.weekStartsOn, defaultCalendarView: preferences.defaultCalendarView })
    const range = getCalendarBookingRange(state, preferences.timezone)
    if (dragSelection) {
      const draftRange = getCalendarBookingRange({ ...state, mode: "day", selected: calendarDateFromValue(dragSelection.day, preferences.timezone) }, preferences.timezone)
      const durationMinutes = dragSelection.endMinute - dragSelection.startMinute
      queryClient.setQueryData(options.availability.getBookingTimes.queryKey({ staffMemberId: dragSelection.member.id, from: draftRange.from, to: draftRange.to, durationMinutes }), { days: [{ date: dragSelection.day, slots: [{ startsAt: "2026-10-14T07:05:00.000Z", endsAt: "2026-10-14T07:50:00.000Z", staffMemberId: dragSelection.member.id, locationId: null }] }] })
    }
    const scheduleKey = options.availability.calendarSchedule.queryKey(range)
    queryClient.setQueryData([...scheduleKey], rules)
    queryClient.setQueryData(options.appointment.list.queryKey(range), bookings)
    for (const booking of bookings) {
      queryClient.setQueryData([...options.appointment.get.queryKey({ id: booking.id })], { ...booking, customerId: booking.customer.id, staffMemberId: booking.staffMember?.id, locationId: null, internalNotes: "Saved booking notes" })
      queryClient.setQueryData([...options.customer.get.queryKey({ id: booking.customer.id })], { ...booking.customer, email: null, phone: null })
    }
    if (refreshError) queryClient.getQueryCache().find({ queryKey: scheduleKey })?.setState({ status: "error", error: new Error("Refresh failed") })
    const PreviewPage = () => createElement(CalendarBookingPreviewContext.Provider, { value: { preview: preview ?? null, setPreview: () => {} } }, createElement(PreviewCalendarState))
    const rootData = { formatPreference: "eu", org: { id: "business" }, organizations: [{ id: "business", role: "owner" }] }
    const router = createMemoryRouter([{ id: "root", path: "/", Component: Outlet, loader: () => rootData, children: [{ path: "calendar", Component: preview === undefined ? CalendarPage : PreviewPage, children: [{ path: "new", Component: NewBooking }, { path: "date-selected", Component: DateSelectedBooking }, { path: ":appointmentId/edit", Component: EditBooking }, { path: "pending", loader: ({ request }) => new Promise<null>((resolve) => { request.signal.addEventListener("abort", () => resolve(null), { once: true }) }) }] }] }], {
      initialEntries: [{ pathname: new URL(url, "https://example.invalid").pathname, search: new URL(url, "https://example.invalid").search, state: { dragSelection, draggedBooking } }], hydrationData: { loaderData: { root: rootData } },
    })
    try {
      if (duringNavigation) {
        void router.navigate("/calendar/pending")
        assert.equal(router.state.navigation.state, "loading", "The edit form is rendered while another navigation is pending")
      }
      return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(QueryClientProvider, { client: queryClient }, createElement(TRPCProvider, { queryClient, trpcClient: trpc, children: createElement(RouterProvider, { router }) }))))
    } finally {
      router.dispose()
    }
  }
  const draggedForm = render({ url: "/calendar/new?view=day&date=2026-10-14", dragSelection: { day: "2026-10-14", member: { id: "alice", name: "Alice" }, startMinute: 605, endMinute: 650 } })
  assert.match(draggedForm, /Start/)
  const startTrigger = [...draggedForm.matchAll(/<button\b[^>]*>/g)].map(([button]) => button).find((button) => button.includes('aria-label="Start"'))
  assert.ok(startTrigger, "The dragged start picker is present")
  assert.doesNotMatch(startTrigger, /\s(?:disabled|data-disabled|aria-disabled)=[""]/, "The start picker is enabled before choosing a service")
  assert.match(draggedForm, /Length \(min\)/)
  assert.match(draggedForm, /value="45"/, "Dragged duration initializes the length field")
  assert.match(draggedForm, /10:05/, "Dragged start initializes the time picker")
  assert.doesNotMatch(draggedForm, />Available times</, "Dragged creation replaces the slot picker")
  assert.match(render({ preview: { startsAt: "2026-10-14T07:05:00Z", endsAt: "2026-10-14T07:50:00Z", member: { id: "alice", name: "Alice" }, service: { id: "", name: "", color: "#808080" } } }), /--appointment-color:#808080/, "A draft without a service is gray")
  const draggedEdit = render({ url: "/calendar/saved-booking/edit?view=day&date=2026-10-14", bookings: [booking], draggedBooking: { appointmentId: booking.id, day: "2026-10-14", member: { id: "alice", name: "Alice" }, startMinute: 725, endMinute: 770 } })
  assert.match(draggedEdit, /aria-label="Start"/, "Dragging a booking opens the start picker immediately")
  assert.match(draggedEdit, /value="45"/, "The edit length comes from the dragged booking")
  assert.match(draggedEdit, /12:05/, "The edit start comes from the drop position")
  assert.doesNotMatch(draggedEdit, />Available times</, "Dragging uses start and length instead of the slot list")
  const navigatingEdit = render({ url: "/calendar/saved-booking/edit?view=day&date=2026-10-14", bookings: [booking], duringNavigation: true })
  const saveCta = [...navigatingEdit.matchAll(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<\/button>/g)].map(([button]) => button).find((button) => button.includes("Save changes"))
  assert.ok(saveCta, "The edit CTA remains visible during calendar navigation")
  assert.doesNotMatch(saveCta, /data-slot="button-loading-indicator"|\sdata-loading=/, "Moving between bookings does not put the save CTA into a submitting state")
  const otherMemberEdit = render({ url: "/calendar/saved-booking/edit?view=week&date=2026-10-14", bookings: [booking], draggedBooking: { appointmentId: booking.id, day: "2026-10-15", member: { id: "bob", name: "Bob" }, startMinute: 725, endMinute: 770 } })
  const movedSummary = otherMemberEdit.match(/<section\b[^>]*aria-label="Booking summary"[^>]*>([\s\S]*?)<\/section>/)?.[0] ?? ""
  assert.match(movedSummary, />Bob</, "The edit summary shows the destination member")
  assert.match(movedSummary, /15\.10\./, "The edit summary shows the destination day")
  const movingPreview: CalendarBookingPreview = { appointmentId: booking.id, status: "CONFIRMED", preserveScroll: true, customerName: "Aino Virtanen", startsAt: "2026-10-14T09:05:00Z", endsAt: "2026-10-14T09:50:00Z", member: { id: "alice", name: "Alice" }, service: { id: "consultation", name: "Consultation", color: "#30968d" } }
  const editingPreview = render({ bookings: [booking], preview: movingPreview })
  assert.match(editingPreview, /data-draft="true"/, "The moved booking remains visible while editing")
  assert.equal((editingPreview.match(/data-appointment-id="saved-booking"/g) ?? []).length, 1, "The moved preview replaces the original instead of duplicating it")
  const editablePreview = render({ url: "/calendar/saved-booking/edit?view=day&date=2026-10-14", bookings: [booking], preview: movingPreview })
  const previewCard = editablePreview.match(/<article\b[^>]*data-appointment-id="saved-booking"[^>]*>/)?.[0] ?? ""
  assert.match(previewCard, /cursor-grab/, "The active preview remains draggable after the edit panel opens")
  assert.match(previewCard, /draggable="false"/, "The preview uses calendar dragging without native browser dragging")
  const otherEditable = render({ url: "/calendar/other-booking/edit?view=day&date=2026-10-14", bookings: [booking] })
  const bookingLink = otherEditable.match(/<a\b[^>]*data-appointment-id="saved-booking"[^>]*>/)?.[0] ?? ""
  assert.match(bookingLink, /draggable="false"/, "Saved booking links cannot be dragged by the browser")
  assert.match(bookingLink, /cursor-grab/, "Other bookings remain draggable while a panel is open")
  assert.match(render({ bookings: [booking], preview: null }), /data-appointment-id="saved-booking"/, "Closing without saving restores the original booking")
  for (const service of [{ id: "", name: "", color: "#808080" }, { id: "consultation", name: "Consultation", color: "#30968d" }]) {
    const creationPreview = render({ url: "/calendar/new?view=day&date=2026-10-14", preview: { preserveScroll: true, startsAt: "2026-10-14T09:05:00Z", endsAt: "2026-10-14T09:50:00Z", member: { id: "alice", name: "Alice" }, service } })
    const placeholder = creationPreview.match(/<article\b[^>]*data-appointment-id="calendar-booking-draft"[^>]*>/)?.[0] ?? ""
    assert.match(placeholder, /cursor-grab/, "The create placeholder can be dragged before and after service selection")
    assert.match(placeholder, /draggable="false"/, "The placeholder uses calendar pointer dragging")
    assert.match(placeholder, new RegExp(`--appointment-color:${service.color}`), "Dragging keeps the placeholder's current service color")
  }
  const assertCalendarHours = (markup: string, startHour: number, endHour: number) => {
    assert.match(markup, new RegExp(`data-slot="calendar-grid" style="[^"]*height:${(endHour - startHour) * 128 + 16}px`), "The grid adds 8px of space at each end of the time range")
    assert.match(markup, /data-slot="calendar-member-lane"[^>]*style="margin-block:8px"/, "Booking lanes exclude the extra space so time positions and durations retain their scale")
  }
  assertCalendarHours(editingPreview, 8, 17)
  const week = render()
  assert.match(week, /data-slot="week-calendar"/, "The business default opens the week view")
  assert.equal((week.match(/data-slot="calendar-member-lane"/g) ?? []).length, 10, "Only two bookable members get lanes on the five weekdays")
  assert.equal((week.match(/data-slot="calendar-hour-line"/g) ?? []).length, 7, "Only interior hour lines render between the 9 to 17 frame borders")
  assertCalendarHours(week, 9, 17)
  assert.doesNotMatch(week, />9:00<|>17:00</, "The first and last time labels are hidden")
  assert.doesNotMatch(week, /08:00|18:00|Inactive|Admin/)
  assert.match(week, /dateTime="2026-10-12"/)
  assert.match(week, /dateTime="2026-10-16"/)
  assert.doesNotMatch(week, /dateTime="2026-10-11"|dateTime="2026-10-17"/)
  assert.match(week, /width:1600px/, "Each date reserves 160px for each bookable member")
  assert.match(week, /data-slot="calendar-horizontal-scroll"/)
  assert.doesNotMatch(week, /data-slot="calendar-appointment"/, "An empty booking query does not invent appointments")
  const booked = render({ bookings: [booking] })
  assert.match(booked, /data-appointment-id="saved-booking"/)
  assert.match(booked, /href="\/calendar\/saved-booking\/edit\?date=2026-10-14"/, "Booking cards open editing while retaining the calendar date")
  const editing = render({ url: "/calendar/saved-booking/edit?view=day&date=2026-10-14", bookings: [booking] })
  assert.match(editing, /data-slot="calendar-side-panel"/, "Editing uses the same inline panel as creating a booking")
  assert.match(editing, /Edit appointment|Save changes/)
  assert.match(editing, /Saved booking notes/, "The edit form renders saved notes on the server")
  assert.match(editing, /Aino Virtanen/, "The edit form renders the current customer")
  assert.doesNotMatch(editing, /data-slot="route-placeholder-sheet"/)
  assert.match(booked, /Aino Virtanen/)
  assert.match(booked, /Booked consultation/)
  assert.match(booked, /--appointment-color:#30968d/)
  assertCalendarHours(booked, 8, 17)
  const closedBooking = render({ bookings: [booking], rules: [{ staffMemberId: null, windows: [] }] })
  assert.match(closedBooking, /data-appointment-id="saved-booking"/, "Saved bookings stay visible on a closed day")
  assert.match(closedBooking, /data-slot="calendar-unavailable-lane"/)
  assert.match(render({ bookings: [{ ...booking, staffMember: { id: "archived", name: "Archived member" } }] }), /Archived member/, "Bookings retain lanes for staff who no longer accept appointments")
  assert.match(render({ bookings: [{ ...booking, staffMember: null }] }), /Unassigned/, "Bookings without staff have a visible lane")
  assert.match(render({ bookings: [{ ...booking, status: "CANCELLED" }] }), /data-status="CANCELLED"/, "Cancelled bookings returned by the query retain their status")
  const split = getCalendarAppointments([{ ...booking, startsAt: "2026-10-13T20:30:00Z", endsAt: "2026-10-13T22:30:00Z" }], [calendarDateFromValue("2026-10-13", "Europe/Helsinki"), calendarDateFromValue("2026-10-14", "Europe/Helsinki")], "Europe/Helsinki")
  assert.deepEqual(split.map(({ day, startMinute, endMinute }) => ({ day, startMinute, endMinute })), [
    { day: "2026-10-13", startMinute: 1410, endMinute: 1440 },
    { day: "2026-10-14", startMinute: 0, endMinute: 90 },
  ], "Overnight bookings split at business-local midnight")
  const normalized = getCalendarAppointments([booking], [calendarDateFromValue("2026-10-14", "Europe/Helsinki")], "Europe/Helsinki")[0]
  const conflictFixtures = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"].map((status) => ({ ...normalized, id: status, status }))
  assert.deepEqual(getCalendarBookingConflicts(conflictFixtures, false).map((appointment) => appointment.id), ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"], "Disabled: active bookings stop calendar dragging")
  assert.deepEqual(getCalendarBookingConflicts(conflictFixtures, true), [], "Enabled: existing bookings do not stop calendar dragging")
  const reservedPreview = { ...normalized, startMinute: 720, endMinute: 780, draft: true }
  const reservedBookings = [normalized, reservedPreview]
  const dropOnSavedTime = (allowSimultaneous: boolean) => {
    const conflicts = getCalendarBookingConflicts(reservedBookings, allowSimultaneous)
    return getCalendarBookingDragRange({
      minute: normalized.startMinute + 15, offset: 0, durationMinutes: 30,
      startMinute: 480, endMinute: 1080, blocked: conflicts, snapAround: conflicts,
    })
  }
  const protectedDrop = dropOnSavedTime(false)
  assert.ok(protectedDrop, "Dropping on the saved time can still snap to a free adjacent time")
  assert.ok(protectedDrop.endMinute <= normalized.startMinute || protectedDrop.startMinute >= normalized.endMinute, "An unsaved preview cannot free the saved booking's time for another booking")
  assert.deepEqual(dropOnSavedTime(true), { startMinute: normalized.startMinute + 15, endMinute: normalized.startMinute + 45 }, "Enabling simultaneous bookings permits the same overlapping calendar drop")
  assert.deepEqual(getCalendarBookingConflicts(reservedBookings, false).filter((appointment) => appointment.id !== normalized.id), [], "Moving the same booking excludes both its saved time and its preview")
  const overlap = layoutCalendarAppointments([
    normalized,
    { ...normalized, id: "overlap", startMinute: 540, endMinute: 600 },
    { ...normalized, id: "following", startMinute: 600, endMinute: 660 },
  ])
  assert.deepEqual(overlap.map(({ column, columns }) => [column, columns]), [[0, 2], [1, 2], [0, 1]], "Overlapping bookings share the lane and touching bookings regain its full width")
  assert.doesNotMatch(week, /data-slot="calendar-unavailable-lane"/, "Members without custom hours inherit the business defaults")
  assert.doesNotMatch(week, /data-slot="calendar-side-panel"/, "The booking panel is closed on the calendar route")
  const newBooking = render({ url: "/calendar/new?view=week&date=2026-10-14" })
  assert.match(newBooking, /data-slot="calendar-container"/)
  assert.match(newBooking, /data-slot="calendar-side-panel"/)
  assert.match(newBooking, /<aside\b[^>]*aria-labelledby=/)
  assert.match(newBooking, /New appointment/)
  assert.match(newBooking, /data-slot="dialog-header"/, "The inline panel uses the modal header")
  assert.match(newBooking, /Choose a service/)
  assert.doesNotMatch(newBooking, /data-slot="dialog-footer"/, "The booking footer stays hidden until a date is selected")
  const dayWithoutSlot = render({ url: "/calendar/date-selected?view=week&date=2026-10-14" })
  assert.doesNotMatch(dayWithoutSlot, /data-slot="dialog-footer"/, "Selecting a day alone does not show the footer before a time slot is picked")
  assert.doesNotMatch(newBooking, /This view is coming soon/)
  assert.match(newBooking, /href="\/calendar\?view=week&amp;date=2026-10-14"/, "Closing the panel preserves the calendar view and date")
  assert.match(newBooking, /data-slot="week-calendar"/, "The calendar stays rendered beside the booking panel")
  assert.doesNotMatch(newBooking, /role="dialog"|aria-modal|data-slot="(?:sheet|dialog|drawer)-(?:popup|backdrop)"/, "The booking panel renders in the page without a modal or backdrop")
  const shuffled = render({ members: [...staff].reverse() })
  assert.deepEqual([...shuffled.matchAll(/title="(Alice|Bob)"/g)].map((match) => match[1]), Array.from({ length: 5 }, () => ["Alice", "Bob"]).flat(), "Header member order stays the same across every day and API response order")
  assert.deepEqual([...shuffled.matchAll(/data-member-id="([^"]+)"/g)].map((match) => match[1]), Array.from({ length: 5 }, () => ["alice", "bob"]).flat(), "Time lanes use the same order as the headers")
  const sameNames = [{ id: "b", name: "Same" }, { id: "a", name: "Same" }]
  assert.deepEqual(sortCalendarMembers(sameNames).map((member) => member.id), ["a", "b"], "Member IDs break ties when names match")
  assert.equal(sameNames[0].id, "b", "Sorting does not mutate cached query data")
  const stale = render({ refreshError: true })
  assert.match(stale, /Couldn’t refresh the calendar/)
  assert.match(stale, /data-slot="week-calendar"/, "A failed refresh keeps the last loaded calendar visible")

  const weekends = render({ settings: { showWeekends: true } })
  assert.equal((weekends.match(/data-slot="calendar-member-lane"/g) ?? []).length, 10)
  assert.doesNotMatch(weekends, /dateTime="2026-10-11"|dateTime="2026-10-17"/, "Closed weekends stay hidden even when showWeekends is enabled")
  const monday = render({ settings: { showWeekends: true, weekStartsOn: 1 } })
  assert.match(monday, /dateTime="2026-10-12"/)
  assert.doesNotMatch(monday, /dateTime="2026-10-11"/)
  const nextYear = render({ url: "/calendar?date=2027-01-01", settings: { showWeekends: true, weekStartsOn: 1 } })
  assert.match(nextYear, /dateTime="2026-12-28"/)
  assert.match(nextYear, /dateTime="2027-01-01"/)
  const window = (day: string, startMinute: number, endMinute: number, timeZone = "Europe/Helsinki") => {
    const start = calendarDateFromValue(day, timeZone)
    start.setHours(Math.floor(startMinute / 60), startMinute % 60)
    const end = calendarDateFromValue(day, timeZone)
    end.setHours(Math.floor(endMinute / 60), endMinute % 60)
    return { start: +start, end: +end }
  }
  const sunday = render({ rules: [{ staffMemberId: "alice", windows: [window("2026-10-11", 360, 1200)] }] })
  assert.match(sunday, /dateTime="2026-10-11"/, "A member’s custom Sunday hours add Sunday despite the weekend display setting")
  assert.doesNotMatch(sunday, /dateTime="2026-10-17"/, "Saturday remains hidden without business or member hours")
  assertCalendarHours(sunday, 6, 20)
  assert.match(sunday, /data-slot="calendar-unavailable-lane"/, "Non-working member periods use stripes")
  assert.doesNotMatch(render({ rules: [{ staffMemberId: "inactive", windows: [window("2026-10-11", 360, 1200)] }] }), /dateTime="2026-10-11"/, "Non-bookable members do not expand the calendar")
  const businessOnly = render({ rules: [{ staffMemberId: null, windows: [window("2026-10-14", 615, 945)] }] })
  assert.equal((businessOnly.match(/data-slot="calendar-member-lane"/g) ?? []).length, 2, "Saved business hours determine visible dates")
  assertCalendarHours(businessOnly, 10, 16)
  assert.doesNotMatch(businessOnly, /9:00|17:00/, "Saved business hours replace the fallback display hours")
  const closed = render({ rules: [{ staffMemberId: null, windows: [] }] })
  assert.doesNotMatch(closed, /No working hours this week|Add business or team working hours/)
  assert.match(closed, /data-slot="week-calendar"/, "A closed week keeps its calendar grid")
  assert.equal((closed.match(/data-slot="calendar-unavailable-lane"/g) ?? []).length, 14, "A fully closed week marks every member's time as unavailable")
  assertCalendarHours(closed, 9, 17)
  const bigger = render({ members: [...staff, { id: "carol", name: "Carol", isActive: true, acceptsAppointments: true }] })
  assert.match(bigger, /width:2400px/, "Column widths grow with the bookable team count")
  const empty = render({ members: [] })
  assert.match(empty, /No team members take appointments yet/)
  assert.match(empty, /data-slot="week-calendar"/, "The calendar still renders without bookable members")
  assert.match(empty, /width:1040px/, "Empty days keep a usable minimum width")
  const day = render({ url: "/calendar?view=day&date=2026-10-14", bookings: [booking] })
  assert.match(day, /data-slot="day-calendar"/)
  assert.match(day, /aria-label="Day calendar"/)
  assert.equal((day.match(/data-slot="calendar-member-lane"/g) ?? []).length, 2, "Day view renders one lane per bookable member")
  assert.deepEqual([...day.matchAll(/title="(Alice|Bob)"/g)].map((match) => match[1]), ["Alice", "Bob"], "Day view retains the staff headings")
  assert.doesNotMatch(day, /data-slot="week-calendar"|data-slot="route-information-architecture"/, "Day view renders the calendar instead of the placeholder")
  assert.equal((day.match(/data-slot="calendar-date-row"/g) ?? []).length, 1, "Day view has one date row")
  assert.match(day, /dateTime="2026-10-14"/)
  assert.match(day, /Wednesday 14\.10\./, "The day date includes the full weekday")
  assert.ok(day.indexOf('data-slot="calendar-date-row"') < day.indexOf('data-slot="calendar-header"'), "The day date stays outside the horizontally scrolling staff headings")
  assert.match(day, /data-appointment-id="saved-booking"/)
  assertCalendarHours(day, 8, 17)
  assert.match(day, /aria-label="Scroll team members"/)
  const dayPanel = render({ url: "/calendar/new?view=day&date=2026-10-14" })
  assert.match(dayPanel, /data-slot="day-calendar"/)
  assert.match(dayPanel, /data-slot="calendar-side-panel"/)
  const closedDay = render({ url: "/calendar?view=day&date=2026-10-17", rules: [{ staffMemberId: null, windows: [] }] })
  assert.match(closedDay, /data-slot="day-calendar"/)
  assert.match(closedDay, /dateTime="2026-10-17"/, "A closed day retains the selected date row")
  assert.equal((closedDay.match(/data-slot="calendar-unavailable-lane"/g) ?? []).length, 2, "Closed days retain staff lanes with unavailable time")
  assert.doesNotMatch(closedDay, /No working hours this day|Add business or team working hours/)
  const personalClosedDay = render({ url: "/calendar?view=day&scope=personal&date=2026-10-17", currentMemberId: "membership-alice", rules: [{ staffMemberId: null, windows: [] }] })
  assert.match(personalClosedDay, /data-slot="day-calendar"/)
  assert.equal((personalClosedDay.match(/data-slot="calendar-member-lane"/g) ?? []).length, 1, "Closed personal days keep the member's calendar visible")
  assert.match(render({ url: "/calendar?view=list&date=2026-10-14" }), /data-slot="route-information-architecture"/, "List view keeps its existing content")
  const preview: CalendarBookingPreview = {
    startsAt: "2026-11-04T05:30:00Z", endsAt: "2026-11-04T06:30:00Z",
    member: { id: "bob", name: "Bob" }, service: { id: "consultation", name: "Consultation", color: "#30968d" },
  }
  for (const mode of ["day", "week"]) {
    const url = `/calendar?view=${mode}&date=2026-10-14`
    const draft = render({ url, preview })
    assert.match(draft, /data-preview-date="2026-11-04"/, "Selecting a slot in another month moves to its business-local date")
    assert.match(draft, /data-original-date="2026-10-14"/, "The booking form retains the original range while previewing")
    assert.match(draft, new RegExp(`data-preview-mode="${mode}"`), "Previewing retains the chosen view")
    assert.match(draft, /data-draft="true"/)
    assert.match(draft, /Draft booking/)
    assert.match(draft, /calendar-draft-pulse_3s/)
    assert.match(draft, /--appointment-color:#30968d/)
    assertCalendarHours(draft, 7, 17)
    const restored = render({ url, preview: null })
    assert.match(restored, /data-preview-date="2026-10-14"/, "Clearing the preview restores the original date")
    assert.doesNotMatch(restored, /data-draft="true"/)
  }
  const closedDraft = render({ url: "/calendar?view=day&date=2026-10-14", preview, rules: [{ staffMemberId: null, windows: [] }] })
  assert.match(closedDraft, /data-draft="true"/, "The draft remains visible even when the calendar has no saved working hours")
  const previewMember = render({ preview: { ...preview, member: { id: "missing", name: "Selected member" } } })
  assert.match(previewMember, /data-member-id="missing"/, "The selected staff member always has a draft lane")
  const today = calendarDateToValue(new TZDate(new Date(), "Europe/Helsinki"))
  const todayRules = [{ staffMemberId: null, windows: [window(today, 540, 1020)] }]
  const initialWeek = render({ url: `/calendar?view=week&date=${today}`, rules: todayRules })
  const weekSection = initialWeek.match(/<section\b[^>]*data-slot="week-calendar"[^>]*>/)?.[0] ?? ""
  assert.match(weekSection, /\binvisible\b/, "Server markup reserves the calendar layout without showing the unpositioned current week")
  assert.match(weekSection, /aria-busy="true"/, "The current week waits for client positioning before being revealed")
  const initialDay = render({ url: `/calendar?view=day&date=${today}`, rules: todayRules })
  const daySection = initialDay.match(/<section\b[^>]*data-slot="day-calendar"[^>]*>/)?.[0] ?? ""
  assert.match(daySection, /\binvisible\b/, "Day server markup hides the grid until the viewport width and scroll position are ready")
  assert.match(daySection, /aria-busy="true"/, "Day view shows its loading state before client positioning")
  assert.match(initialDay, />Today</, "Today's day view has a useful relative label")
  const relativeDate = (offset: number) => {
    const day = calendarDateFromValue(today, "Europe/Helsinki")
    day.setDate(day.getDate() + offset)
    return calendarDateToValue(day)
  }
  const tomorrow = relativeDate(1)
  const tomorrowRules = [{ staffMemberId: null, windows: [window(tomorrow, 540, 1020)] }]
  assert.match(render({ url: `/calendar?view=day&date=${tomorrow}`, rules: tomorrowRules }), />Tomorrow</)
  const yesterday = relativeDate(-1)
  assert.match(render({ url: `/calendar?view=day&date=${yesterday}`, rules: [{ staffMemberId: null, windows: [window(yesterday, 540, 1020)] }] }), />Yesterday</)
  const memberSelectMarkup = (markup: string) => markup.match(/<div\b[^>]*data-slot="calendar-member-select"[^>]*>([\s\S]*?)<\/button>/)?.[1] ?? ""
  assert.match(memberSelectMarkup(render()), />Whole team</, "The member select defaults to all team members")
  assert.doesNotMatch(render(), /data-slot="calendar-personal-switch"|role="switch"/, "The member select replaces the personal switch")
  for (const currentMemberId of [undefined, "membership-admin", "membership-inactive", "unlinked-member"]) {
    const unavailablePersonal = render({ url: "/calendar?view=day&scope=personal&date=2026-10-14", currentMemberId })
    assert.match(memberSelectMarkup(unavailablePersonal), />Whole team</, "Every user can select a calendar even without a bookable profile")
    assert.equal((unavailablePersonal.match(/data-slot="calendar-member-lane"/g) ?? []).length, 2, "An unavailable personal filter falls back to the team calendar")
  }
  const otherBooking = { ...booking, id: "bob-booking", staffMember: { id: "bob", name: "Bob" } }
  for (const mode of ["day", "week"]) {
    const personal = render({ url: `/calendar?view=${mode}&scope=personal&date=2026-10-14`, currentMemberId: "membership-alice", bookings: [booking, otherBooking, { ...booking, id: "unassigned-booking", staffMember: null }] })
    assert.match(personal, /data-member-id="alice"/)
    assert.doesNotMatch(personal, /data-member-id="bob"|data-member-id="unassigned"|data-appointment-id="bob-booking"|data-appointment-id="unassigned-booking"/, "Personal views omit other staff and unassigned bookings")
    assert.match(personal, /data-appointment-id="saved-booking"/)
    assert.match(memberSelectMarkup(personal), />Alice</, "Existing personal calendar URLs select the signed-in member")
    assert.equal((personal.match(/data-slot="calendar-member-lane"/g) ?? []).length, mode === "day" ? 1 : 5)
    const selectedBob = render({ url: `/calendar?view=${mode}&member=bob&date=2026-10-14`, currentMemberId: "membership-alice", bookings: [booking, otherBooking] })
    assert.match(memberSelectMarkup(selectedBob), />Bob</, "The select displays the chosen member during server rendering")
    assert.match(selectedBob, /data-appointment-id="bob-booking"/)
    assert.doesNotMatch(selectedBob, /data-member-id="alice"|data-appointment-id="saved-booking"/, "Selecting another member filters their calendar in either view")
    const allMembers = render({ url: `/calendar?view=${mode}&date=2026-10-14`, bookings: [booking, otherBooking] })
    assert.match(allMembers, /data-appointment-id="bob-booking"/)
    assert.match(allMembers, /data-appointment-id="saved-booking"/, "All restores everyone's appointments")
  }
  for (const invalidMember of ["inactive", "admin", "unknown"]) {
    const fallback = render({ url: `/calendar?view=day&member=${invalidMember}&date=2026-10-14` })
    assert.match(memberSelectMarkup(fallback), />Whole team</)
    assert.equal((fallback.match(/data-slot="calendar-member-lane"/g) ?? []).length, 2, "Inactive, non-bookable and unknown member IDs fall back to all")
  }
  const personalRules = [{ staffMemberId: "alice", windows: [window("2026-10-14", 660, 900)] }, { staffMemberId: "bob", windows: [window("2026-10-11", 360, 1200)] }]
  const ownHours = render({ url: "/calendar?view=week&member=alice&date=2026-10-14", rules: personalRules })
  assert.equal((ownHours.match(/data-slot="calendar-member-lane"/g) ?? []).length, 1, "Personal working days follow the member's own schedule")
  assertCalendarHours(ownHours, 11, 15)
  assert.doesNotMatch(ownHours, /9:00|17:00|dateTime="2026-10-11"/, "Business hours and other staff do not expand personal working hours")
  const teamAgain = render({ currentMemberId: "membership-alice", bookings: [booking, otherBooking] })
  assert.match(teamAgain, /data-appointment-id="bob-booking"/, "The team calendar still shows everyone when the switch is off")
  await i18n.changeLanguage("fi")
  const finnish = render()
  assert.match(finnish, /Viikkokalenteri/)
  assert.match(finnish, /Vieritä kalenterin päiviä/)
  assert.match(finnish, /14\.10\./)
  assert.match(render({ url: "/calendar?view=day&date=2026-10-14" }), /Päiväkalenteri/)
  assert.match(memberSelectMarkup(render()), />Koko tiimi</)
  assert.match(render({ url: `/calendar?view=day&date=${today}`, rules: todayRules }), />Tänään</)
  assert.match(render({ url: `/calendar?view=day&date=${tomorrow}`, rules: tomorrowRules }), />Huomenna</)
  mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-14T06:04:00Z") })
  try {
    for (const [time, visible] of [["06:04", false], ["06:05", true], ["13:55", true], ["13:56", false]] as const) {
      mock.timers.setTime(Date.parse(`2026-10-14T${time}:00Z`))
      for (const mode of ["day", "week"]) {
        const markup = render({ url: `/calendar?view=${mode}&date=2026-10-14`, rules: [{ staffMemberId: null, windows: [window("2026-10-14", 540, 1020)] }] })
        assert.equal(markup.includes('data-slot="calendar-current-time"'), visible, `${mode} shows the line only from five minutes after opening until five minutes before closing`)
        assert.equal(markup.includes('data-slot="calendar-current-time-label"'), visible, "The time label follows the same cutoff as the line")
      }
    }
  } finally {
    mock.timers.reset()
  }
  console.log("Week calendar checks passed")
} finally {
  queryClient.clear()
  await vite.close()
}
