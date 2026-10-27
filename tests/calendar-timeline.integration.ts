import type { CalendarBookingPreview } from "../app/lib/calendar/types"
import "dotenv/config"
import assert from "node:assert/strict"
import { mock } from "node:test"
import { createElement } from "react"
import { TZDate } from "react-day-picker"
import { renderToStaticMarkup } from "react-dom/server"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import { createMemoryRouter, Outlet, RouterProvider } from "react-router"
import { createServer } from "vite"
import type { CalendarScheduleRule } from "../app/lib/calendar/schedule"
import type { inferRouterOutputs } from "@trpc/server"
import type { appRouter } from "../app/.server/main"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/calendar-timeline",
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
  const { getCalendarBookingDragRange } = await vite.ssrLoadModule("/app/lib/calendar/booking-drag.ts") as typeof import("../app/lib/calendar/booking-drag")
  const { CalendarSchedule } = await vite.ssrLoadModule("/app/components/calendar/calendar-schedule.tsx")
  const { useCalendarState } = await vite.ssrLoadModule("/app/components/calendar/use-calendar-state.ts") as typeof import("../app/components/calendar/use-calendar-state")
  const { CalendarBookingForm } = await vite.ssrLoadModule("/app/components/calendar/calendar-booking-form.tsx")
  const DateSelectedBooking = () => createElement(CalendarBookingForm, { selectedDay: "2026-10-14", onSelectedDayChange: () => {}, onSelectedTimeChange: () => {} })
  const { BookingSlotList, bookingSlotKey } = await vite.ssrLoadModule("/app/components/calendar/booking-slot-list.tsx") as typeof import("../app/components/calendar/booking-slot-list")
  const beforeClientLoader = Date.now()
  const clientState = clientLoader()
  assert.ok(clientState.now >= beforeClientLoader && clientState.now <= Date.now(), "Client navigation supplies a current clock snapshot")
  assert.deepEqual(Object.keys(clientState), ["now"], "Client navigation leaves data fetching to TanStack Query")
  const { sortCalendarMembers } = await vite.ssrLoadModule("/app/lib/calendar/schedule.ts") as typeof import("../app/lib/calendar/schedule")
  const { getCalendarAppointments, layoutCalendarAppointments, getCalendarBookingConflicts } = await vite.ssrLoadModule("/app/lib/calendar/appointments.ts") as typeof import("../app/lib/calendar/appointments")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const { TRPCProvider, trpc } = await vite.ssrLoadModule("/app/lib/trpc/client.tsx") as typeof import("../app/lib/trpc/client")
  const { calendarDateFromValue, calendarDateToValue, getCalendarDateState, getCalendarBookingRange, getCalendarTimeRange } = await vite.ssrLoadModule("/app/lib/calendar/date.ts") as typeof import("../app/lib/calendar/date")
  function PreviewCalendarState() {
    const calendar = useCalendarState()
    const original = useCalendarState({ preview: false })
    return createElement("div", { "data-preview-date": calendarDateToValue(calendar.selected), "data-original-date": calendarDateToValue(original.selected), "data-preview-mode": calendar.mode }, createElement(CalendarSchedule), createElement(Outlet))
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
  assert.deepEqual(bookingRange("date=2026-10-14&view=list", 0), bookingRange("date=2026-10-14&view=week", 0), "List bookings cover the full business week")
  assert.deepEqual(bookingRange("date=2026-10-25&view=list"), bookingRange("date=2026-10-25&view=week"), "List weeks keep timezone boundaries across daylight saving changes")
  const options = createTRPCOptionsProxy({ client: trpc, queryClient })
  queryClient.setQueryData([...options.service.list.queryKey()], [{ id: "consultation", name: "Consultation", isActive: true, durationMinutes: 30 }])
  queryClient.setQueryData(options.service.bookingUsage.queryKey(), [])
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
    members: [{ id: "bob", name: "Bob" }, { id: "alice", name: "Alice" }],
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
    services: [{ serviceId: "consultation", name: "Booked consultation", durationMinutes: 60, bufferBeforeMinutes: 5, bufferAfterMinutes: 10, service: { color: "#30968d" } }],
  }
  function render({ appointmentPending = false, membersPending = false, availabilityState = "ready" as "ready" | "pending" | "fetching", now = Date.now(), url = "/calendar?date=2026-10-14", settings = {}, members = staff, rules = [] as CalendarScheduleRule[], refreshError = false, duringNavigation = false, dragging = false, dragUpdate = undefined as import("../app/lib/calendar/types").CalendarBookingDragUpdate | undefined, bookings = [] as Booking[], preview = undefined as CalendarBookingPreview | null | undefined, currentMemberId = undefined as string | undefined, dragSelection = undefined as import("../app/lib/calendar/types").CalendarDragSelection | undefined, draggedBooking = undefined as (import("../app/lib/calendar/types").CalendarDragSelection & { appointmentId: string }) | undefined } = {}) {
    queryClient.setQueryData([...options.organizations.getCurrent.queryKey()], { id: "business", memberId: currentMemberId, settings: { ...defaults, ...settings } })
    queryClient.setQueryData([...options.staff.list.queryKey()], members)
    if (membersPending) queryClient.removeQueries({ queryKey: options.staff.list.queryKey(), exact: true })
    const preferences = { ...defaults, ...settings }
    const params = new URL(url, "https://example.invalid").searchParams
    if (preview) params.set("date", calendarDateToValue(new TZDate(preview.startsAt, preferences.timezone)))
    const state = getCalendarDateState(params, { now, timeZone: preferences.timezone, weekStartsOn: preferences.weekStartsOn, defaultCalendarView: preferences.defaultCalendarView })
    const range = getCalendarBookingRange(state, preferences.timezone)
    if (dragSelection) {
      const draftRange = getCalendarBookingRange({ ...state, mode: "day", selected: calendarDateFromValue(dragSelection.day, preferences.timezone) }, preferences.timezone)
      const durationMinutes = dragSelection.endMinute - dragSelection.startMinute
      const selectedStart = getCalendarTimeRange(dragSelection.day, dragSelection.startMinute, durationMinutes, preferences.timezone).startsAt
      queryClient.setQueryData(options.availability.getBookingTimes.queryKey({ from: draftRange.from, to: draftRange.to, durationMinutes, selectedStart }), { days: [{ date: dragSelection.day, slots: [{ startsAt: "2026-10-14T07:05:00.000Z", endsAt: "2026-10-14T07:50:00.000Z", staffMemberId: dragSelection.member.id, locationId: null }] }] })
      if (availabilityState === "pending") queryClient.removeQueries({ queryKey: options.availability.getBookingTimes.queryKey({ from: draftRange.from, to: draftRange.to, durationMinutes, selectedStart }), exact: true })
    }
    const scheduleKey = options.availability.calendarSchedule.queryKey(range)
    queryClient.setQueryData([...scheduleKey], rules)
    queryClient.setQueryData(options.appointment.list.queryKey(range), bookings)
    if (state.mode === "list") queryClient.setQueryData(options.appointment.list.queryKey({ ...range, includeCancelled: true }), bookings)
    for (const booking of bookings) {
      queryClient.setQueryData([...options.appointment.get.queryKey({ id: booking.id })], { ...booking, services: booking.services.map((item, index) => ({ ...item, id: `${booking.id}/${index}`, service: item.service ? { ...item.service, durationMinutes: 30 } : null })), customer: { ...booking.customer, email: "aino@example.invalid", phone: "+358401234567" }, customerId: booking.customer.id, staffMemberId: booking.staffMember?.id, locationId: null, answers: [], customerNotes: null, internalNotes: "Saved booking notes" })
      queryClient.setQueryData([...options.customer.get.queryKey({ id: booking.customer.id })], { ...booking.customer, email: null, phone: null })
      const selectedDrag = dragUpdate?.appointmentId === booking.id ? dragUpdate.selection : draggedBooking?.appointmentId === booking.id ? draggedBooking : undefined
      if (selectedDrag) {
        const selectedRange = getCalendarBookingRange({ ...state, mode: "day", selected: calendarDateFromValue(selectedDrag.day, preferences.timezone) }, preferences.timezone)
        const durationMinutes = selectedDrag.endMinute - selectedDrag.startMinute
        const time = getCalendarTimeRange(selectedDrag.day, selectedDrag.startMinute, durationMinutes, preferences.timezone)
        const bookedService = booking.services[0]
        queryClient.setQueryData(options.appointment.list.queryKey({ from: new Date(+time.startsAt - (240 + (bookedService?.bufferBeforeMinutes ?? 0)) * 60000), to: new Date(+time.startsAt + (1680 + (bookedService?.bufferAfterMinutes ?? 0)) * 60000), staffMemberId: selectedDrag.member.id }), bookings)
        queryClient.setQueryData(options.appointment.getBookingTimes.queryKey({ id: booking.id, ...selectedRange, staffMemberId: null, durationMinutes, selectedStart: time.startsAt }), { days: [{ date: selectedDrag.day, slots: [{ startsAt: time.startsAt.toISOString(), endsAt: time.endsAt.toISOString(), staffMemberId: selectedDrag.member.id, locationId: null }] }] })
        const availabilityKey = options.appointment.getBookingTimes.queryKey({ id: booking.id, ...selectedRange, staffMemberId: null, durationMinutes, selectedStart: time.startsAt })
        if (availabilityState === "pending") queryClient.removeQueries({ queryKey: availabilityKey, exact: true })
        if (availabilityState === "fetching") queryClient.getQueryCache().find({ queryKey: availabilityKey, exact: true })?.setState({ fetchStatus: "fetching" })
      }
    }
    if (appointmentPending) queryClient.removeQueries({ queryKey: options.appointment.get.queryKey(), exact: false })
    if (refreshError) queryClient.getQueryCache().find({ queryKey: scheduleKey })?.setState({ status: "error", error: new Error("Refresh failed") })
    const PreviewPage = () => createElement(CalendarBookingPreviewContext.Provider, { value: { preview: preview ?? null, setPreview: () => {}, dragging, dragUpdate } }, createElement(PreviewCalendarState))
    const rootData = { formatPreference: "eu", org: { id: "business" }, organizations: [{ id: "business", role: "owner" }] }
    const router = createMemoryRouter([{ id: "root", path: "/", Component: Outlet, loader: () => rootData, children: [{ id: "routes/calendar/calendar", path: "calendar", Component: preview === undefined ? CalendarPage : PreviewPage, children: [{ path: "new", Component: NewBooking }, { path: "date-selected", Component: DateSelectedBooking }, { path: ":appointmentId/edit", Component: EditBooking }, { path: "pending", loader: ({ request }) => new Promise<null>((resolve) => { request.signal.addEventListener("abort", () => resolve(null), { once: true }) }) }] }] }], {
      initialEntries: [{ pathname: new URL(url, "https://example.invalid").pathname, search: new URL(url, "https://example.invalid").search, state: { dragSelection, draggedBooking } }], hydrationData: { loaderData: { root: rootData, "routes/calendar/calendar": { now } } },
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
  const regularCreate = render({ url: "/calendar/new?view=day&date=2026-10-14" })
  const mobileHeader = regularCreate.match(/<header\b[^>]*class="[^"]*route-header[^>]*>([\s\S]*?)<\/header>/)?.[1] ?? ""
  assert.match(mobileHeader, /data-slot="calendar-view-controls"/, "The initial server render already places the mobile controls inside the header")
  assert.match(mobileHeader, /data-slot="calendar-member-select"/, "Loading and loaded mobile headers reserve the same member-control row")
  const renderHeader = (markup: string) => markup.match(/<header\b[^>]*class="[^"]*route-header[^>]*>([\s\S]*?)<\/header>/)?.[1] ?? ""
  const initialWeekPage = render({ url: "/calendar?view=week&date=2026-10-14" })
  const initialMobileHeader = renderHeader(initialWeekPage)
  assert.match(initialMobileHeader, /aria-label="Choose date"/, "Mobile date controls render a day picker before hydration even when the saved view is week")
  assert.match(initialMobileHeader, /<button(?=[^>]*aria-label="Day")(?=[^>]*aria-pressed="true")[^>]*>/, "The mobile day switch is selected before hydration")
  assert.doesNotMatch(initialMobileHeader, /aria-label="Choose week"|Whole team/, "Mobile inputs never initially display the desktop week or team selection")
  assert.match(initialMobileHeader, /data-slot="select-value"[^>]*>Alice<\/span>/, "The initial mobile member input shows the first bookable person")
  const desktopControls = initialWeekPage.slice(initialWeekPage.indexOf("</header>") + "</header>".length)
  assert.match(desktopControls, /aria-label="Choose week"/, "Desktop controls retain the saved week view")
  assert.match(desktopControls, /data-slot="select-value"[^>]*>Whole team<\/span>/, "Desktop controls retain the team selection")
  const personalMobileHeader = renderHeader(render({ currentMemberId: "membership-bob" }))
  assert.match(personalMobileHeader, /data-slot="select-value"[^>]*>[\s\S]*?>Bob<\/span>/, "Mobile inputs initially select the signed-in person's calendar")
  assert.match(personalMobileHeader, /data-slot="badge"[^>]*>You<\/span>/, "The selected signed-in member has a You badge")
  const requestedMobileHeader = renderHeader(render({ url: "/calendar?member=alice&date=2026-10-14", currentMemberId: "membership-bob" }))
  assert.match(requestedMobileHeader, /data-slot="select-value"[^>]*>Alice<\/span>/, "An explicit member selection takes priority on the initial mobile render")
  assert.doesNotMatch(requestedMobileHeader, /data-slot="badge"/, "Other members do not receive a You badge")
  assert.match(renderHeader(render({ url: "/calendar?view=list&date=2026-10-14" })), /<button(?=[^>]*aria-label="List")(?=[^>]*aria-pressed="true")[^>]*>/, "Mobile controls preserve an explicitly selected list view")
  assert.match(regularCreate, /aria-label="Length \(min\)"/, "Creating without dragging offers an editable duration")
  assert.match(regularCreate, /class="[^"]*cursor-default"[^>]*data-slot="calendar-member-lane"/, "Drag lanes start with the default cursor until the pointer enters free time")
  const regularEdit = render({ url: "/calendar/saved-booking/edit?view=day&date=2026-10-14", bookings: [booking] })
  const subtitleText = (markup: string) => markup.match(/data-slot="calendar-panel-subtitle"[^>]*>([^<]+)</)?.[1]
  const loadingEdit = render({ appointmentPending: true, url: "/calendar/saved-booking/edit?view=day&date=2026-10-14", bookings: [booking] })
  assert.ok(subtitleText(loadingEdit), "The edit subtitle shows date and time before booking details load")
  assert.equal(subtitleText(loadingEdit), subtitleText(regularEdit), "The loading subtitle matches the loaded booking date and time")
  assert.doesNotMatch(loadingEdit, /Saved booking notes/, "Booking details are still loading while its subtitle is visible")
  assert.match(regularEdit, /aria-label="Length \(min\)"/, "Editing without dragging offers an editable duration")
  assert.match(regularEdit, /value="60"/, "The duration defaults to the saved booking length")
  assert.ok(regularEdit.indexOf("Booked consultation") < regularEdit.indexOf('aria-label="Length (min)"'), "The duration appears below the service")
  assert.doesNotMatch(regularEdit, /aria-label="Booking summary"/, "Editing shows fields instead of a summary card")
  assert.match(regularEdit, /Aino Virtanen/, "The customer field shows the saved customer")
  assert.ok(regularEdit.indexOf("Aino Virtanen") < regularEdit.indexOf('aria-label="Service"'), "The customer field comes before the service")
  const servicePicker = regularEdit.match(/<button[^>]*aria-label="Service"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? ""
  assert.match(servicePicker, /data-slot="combobox-trigger"/, "Editing uses the same service picker as creation")
  assert.match(servicePicker, /Booked consultation/, "The service picker retains the booked service name")
  assert.match(servicePicker, /background-color:#30968d/, "The booked service has its own color dot")
  assert.doesNotMatch(servicePicker, /disabled=""/, "The service can be changed for an editable booking")
  const multipleServices = render({ url: "/calendar/saved-booking/edit?view=day&date=2026-10-14", bookings: [{ ...booking, services: [...booking.services, { ...booking.services[0], serviceId: "follow-up", name: "Follow-up", service: { color: "#8f49b5" } }] }] })
  const multipleServicePickers = [...multipleServices.matchAll(/<button[^>]*aria-label="Service"[^>]*>[\s\S]*?<\/button>/g)].map(([picker]) => picker)
  assert.equal(multipleServicePickers.length, 2, "Each service in an existing multi-service booking retains its own picker")
  assert.match(multipleServicePickers[0], /background-color:#30968d/)
  assert.match(multipleServicePickers[1], /Follow-up/)
  assert.match(multipleServicePickers[1], /background-color:#8f49b5/)
  const draggedForm = render({ url: "/calendar/new?view=day&date=2026-10-14", dragSelection: { day: "2026-10-14", member: { id: "alice", name: "Alice" }, startMinute: 605, endMinute: 650 } })
  assert.doesNotMatch(draggedForm, /aria-label="Start"/, "Dragged creation uses available-time slots instead of a separate start picker")
  assert.match(draggedForm, /Length \(min\)/)
  assert.match(draggedForm, /value="45"/, "Dragged duration initializes the length field")
  assert.match(draggedForm, />Available times</, "Dragged and regular creation share the available-time field")
  assert.match(draggedForm, /data-slot="booking-slot-list"/, "Dragged creation shows the available-time list before choosing a service")
  assert.doesNotMatch(draggedForm, /data-slot="dialog-footer"/, "A dragged time without a service keeps the footer hidden")
  assert.match(draggedForm, /Choose a service/, "A custom forty-five-minute draft leaves the service blank")
  const defaultServices = queryClient.getQueryData(options.service.list.queryKey())
  queryClient.setQueryData([...options.service.list.queryKey()], [
    { id: "consultation", name: "Consultation", durationMinutes: 30, isActive: true },
    { id: "popular-consultation", name: "Popular consultation", durationMinutes: 30, isActive: true },
    { id: "long-consultation", name: "Long consultation", durationMinutes: 90, isActive: true },
  ])
  queryClient.setQueryData(options.service.bookingUsage.queryKey(), [{ serviceId: "popular-consultation", bookings: 12 }, { serviceId: "long-consultation", bookings: 50 }])
  const matchedDraft = render({ url: "/calendar/new?view=day&date=2026-10-14", dragSelection: { day: "2026-10-14", member: { id: "alice", name: "Alice" }, startMinute: 600, endMinute: 630 } })
  assert.match(matchedDraft, /Popular consultation/, "New drafts suggest the most-used service with the matching length")
  assert.match(matchedDraft, /value="30"/, "A matching suggestion preserves the dragged length")
  const popularDefault = render({ url: "/calendar/new?view=day&date=2026-10-14" })
  assert.match(popularDefault, /Long consultation/, "A new flow without a dragged length suggests the most-used service")
  assert.match(popularDefault, /value="90"/, "The default service supplies the initial booking length")
  queryClient.setQueryData(options.service.list.queryKey(), defaultServices)
  queryClient.setQueryData(options.service.bookingUsage.queryKey(), [])
  const draggedSlots = draggedForm.slice(draggedForm.indexOf('data-slot="booking-slot-list"'))
  assert.match(draggedSlots, /10:05/, "The list includes the dragged start time")
  assert.equal((draggedSlots.match(/aria-pressed="true"/g) ?? []).length, 1, "The dragged time is selected when server availability is ready")
  const cachedServices = queryClient.getQueryData(options.service.list.queryKey())
  queryClient.removeQueries({ queryKey: options.service.list.queryKey(), exact: true })
  const loadingCreate = render({ url: "/calendar/new?view=day&date=2026-10-14", dragSelection: { day: "2026-10-14", member: { id: "alice", name: "Alice" }, startMinute: 605, endMinute: 650 }, availabilityState: "pending" })
  const loadingCreatePanel = loadingCreate.slice(loadingCreate.indexOf('data-slot="calendar-side-panel"'))
  assert.equal((loadingCreatePanel.match(/role="status"/g) ?? []).length, 1, "Loading services and booking times together shows one panel spinner")
  assert.ok(loadingCreatePanel.indexOf('role="status"') > loadingCreatePanel.indexOf('>Available times<'), "The loading spinner belongs to the slots area")
  const servicesOnlyLoading = render({ url: "/calendar/new?view=day&date=2026-10-14" })
  const servicesOnlyPanel = servicesOnlyLoading.slice(servicesOnlyLoading.indexOf('data-slot="calendar-side-panel"'))
  assert.doesNotMatch(servicesOnlyPanel, /role="status"/, "Loading services alone does not show a spinner")
  const readyTimesWithLoadingServices = render({ url: "/calendar/new?view=day&date=2026-10-14", dragSelection: { day: "2026-10-14", member: { id: "alice", name: "Alice" }, startMinute: 605, endMinute: 650 } })
  const readyTimesPanel = readyTimesWithLoadingServices.slice(readyTimesWithLoadingServices.indexOf('data-slot="calendar-side-panel"'))
  assert.match(readyTimesPanel, /data-slot="booking-slot-list"/, "Ready slots stay visible while services load")
  assert.doesNotMatch(readyTimesPanel, /role="status"/, "Ready slots do not show a service-loading spinner")
  queryClient.setQueryData(options.service.list.queryKey(), cachedServices)
  const loadingTimes = render({ url: "/calendar/new?view=day&date=2026-10-14", dragSelection: { day: "2026-10-14", member: { id: "alice", name: "Alice" }, startMinute: 605, endMinute: 650 }, availabilityState: "pending" })
  const loadingTimesPanel = loadingTimes.slice(loadingTimes.indexOf('data-slot="calendar-side-panel"'))
  assert.equal((loadingTimesPanel.match(/role="status"/g) ?? []).length, 1, "Loading booking times after services are ready retains one spinner")
  assert.match(render({ preview: { startsAt: "2026-10-14T07:05:00Z", endsAt: "2026-10-14T07:50:00Z", member: { id: "alice", name: "Alice" }, service: { id: "", name: "", color: "#808080" } } }), /--appointment-color:#808080/, "A draft without a service is gray")
  const draggedEdit = render({ url: "/calendar/saved-booking/edit?view=day&date=2026-10-14", bookings: [booking], draggedBooking: { appointmentId: booking.id, day: "2026-10-14", member: { id: "alice", name: "Alice" }, startMinute: 725, endMinute: 770 } })
  assert.doesNotMatch(draggedEdit, /aria-label="Start"/, "Dragged editing uses the regular available-time controls")
  assert.match(draggedEdit, /data-slot="booking-slot-list"/, "Dragging a booking shows available-time buttons")
  assert.match(draggedEdit, /aria-pressed="true"/, "The dropped time is selected in the available-time buttons")
  assert.match(draggedEdit, /value="45"/, "The edit length comes from the dragged booking")
  assert.match(draggedEdit, /12:05/, "The edit start comes from the drop position")
  assert.match(draggedEdit, />Available times</, "Dragged and regular editing share the available-time field")
  const currentTimeEdit = render({ url: "/calendar/saved-booking/edit?view=day&date=2026-10-14", bookings: [booking], draggedBooking: { appointmentId: booking.id, day: "2026-10-14", member: { id: "alice", name: "Alice" }, startMinute: 510, endMinute: 570 } })
  assert.match(currentTimeEdit, />Current</, "The saved booking time is marked in the time slots")
  assert.match(currentTimeEdit, /aria-pressed="true"/, "The current booking time is selected")
  for (const availabilityState of ["pending", "fetching"] as const) {
    const loadingTimes = render({ availabilityState, url: "/calendar/saved-booking/edit?view=day&date=2026-10-14", bookings: [booking], draggedBooking: { appointmentId: booking.id, day: "2026-10-14", member: { id: "alice", name: "Alice" }, startMinute: 510, endMinute: 570 } })
    assert.doesNotMatch(loadingTimes, /data-slot="booking-slot-list"/, `${availabilityState} availability waits before showing slots`)
    const timesGroup = loadingTimes.slice(loadingTimes.indexOf('aria-label="Available times"'))
    assert.match(timesGroup, /role="status"/, "The available times area shows a spinner while loading")
    const saveButton = [...loadingTimes.matchAll(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<\/button>/g)].map(([button]) => button).find((button) => button.includes("Save changes"))
    assert.match(saveButton ?? "", /\sdisabled(?:=|[ >])/, "Saving waits for the server availability result")
  }
  const nextBooking = { ...booking, id: "next-booking", startsAt: new Date("2026-10-14T06:40:00Z"), endsAt: new Date("2026-10-14T07:10:00Z") }
  const limitedDurationEdit = render({ url: "/calendar/saved-booking/edit?view=day&date=2026-10-14", bookings: [booking, nextBooking], draggedBooking: { appointmentId: booking.id, day: "2026-10-14", member: { id: "alice", name: "Alice" }, startMinute: 510, endMinute: 580 } })
  const incrementButton = (markup: string) => markup.match(/<button[^>]*data-slot="number-field-increment"[^>]*>/)?.[0] ?? ""
  assert.match(incrementButton(limitedDurationEdit), /disabled=""/, "The panel stops extending when the duration reaches the next booking")
  const simultaneousDurationEdit = render({ url: "/calendar/saved-booking/edit?view=day&date=2026-10-14", settings: { allowSimultaneousBookings: true }, bookings: [booking, nextBooking], draggedBooking: { appointmentId: booking.id, day: "2026-10-14", member: { id: "alice", name: "Alice" }, startMinute: 510, endMinute: 580 } })
  assert.ok(incrementButton(simultaneousDurationEdit), "The duration increment button is present")
  assert.doesNotMatch(incrementButton(simultaneousDurationEdit), /disabled=""/, "Simultaneous bookings permit extending past other bookings")
  const navigatingEdit = render({ url: "/calendar/saved-booking/edit?view=day&date=2026-10-14", bookings: [booking], duringNavigation: true })
  const saveCta = [...navigatingEdit.matchAll(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<\/button>/g)].map(([button]) => button).find((button) => button.includes("Save changes"))
  assert.ok(saveCta, "The edit CTA remains visible during calendar navigation")
  assert.doesNotMatch(saveCta, /data-slot="button-loading-indicator"|\sdata-loading=/, "Moving between bookings does not put the save CTA into a submitting state")
  const otherMemberEdit = render({ url: "/calendar/saved-booking/edit?view=week&date=2026-10-14", bookings: [booking], draggedBooking: { appointmentId: booking.id, day: "2026-10-15", member: { id: "bob", name: "Bob" }, startMinute: 725, endMinute: 770 } })
  assert.match(otherMemberEdit, /Bob/, "Available times show the destination member")
  assert.match(otherMemberEdit, /15\.10\./, "The date field shows the destination day")
  const movingPreview: CalendarBookingPreview = { appointmentId: booking.id, status: "CONFIRMED", preserveScroll: true, customerName: "Aino Virtanen", startsAt: "2026-10-14T09:05:00Z", endsAt: "2026-10-14T09:50:00Z", member: { id: "alice", name: "Alice" }, service: { id: "consultation", name: "Consultation", color: "#30968d" } }
  const liveSelection = { day: "2026-10-15", member: { id: "bob", name: "Bob" }, startMinute: 725, endMinute: 815 }
  const liveDateState = getCalendarDateState(new URLSearchParams({ date: liveSelection.day, view: "day" }), { timeZone: "Europe/Helsinki" })
  const liveRange = getCalendarBookingRange(liveDateState, "Europe/Helsinki")
  function assertLiveAvailability(queryKey: readonly unknown[], label: string, expectedRequests = 1) {
    const query = queryClient.getQueryCache().find({ queryKey, exact: true })
    assert.ok(query, `${label} configures the live availability query`)
    const client = new QueryClient()
    let requests = 0
    const observer = new QueryObserver(client, {
      ...query.options,
      queryKey,
      queryFn: async () => { requests += 1; return { days: [] } },
    })
    const unsubscribe = observer.subscribe(() => {})
    try {
      assert.equal(requests, expectedRequests, `${label} ${expectedRequests ? "fetches uncached data" : "does not start extra requests while the pointer moves"}`)
    } finally {
      unsubscribe()
      client.clear()
    }
  }
  const liveEditOptions = { url: "/calendar/saved-booking/edit?view=week&date=2026-10-14", bookings: [booking], preview: { ...movingPreview, startsAt: "2026-10-15T09:05:00Z", endsAt: "2026-10-15T10:35:00Z", member: liveSelection.member }, dragging: true, dragUpdate: { appointmentId: booking.id, selection: liveSelection }, draggedBooking: { appointmentId: booking.id, day: "2026-10-14", member: { id: "alice", name: "Alice" }, startMinute: 605, endMinute: 650 } }
  const liveEdit = render(liveEditOptions)
  assertLiveAvailability(options.appointment.getBookingTimes.queryKey({ id: booking.id, ...liveRange, staffMemberId: null, durationMinutes: 90, selectedStart: getCalendarTimeRange(liveSelection.day, liveSelection.startMinute, 90, "Europe/Helsinki").startsAt }), "Dragging an existing booking")
  assert.match(liveEdit, /data-slot="calendar-side-panel"/, "The edit panel stays visible during a drag")
  assert.match(liveEdit, /value="90"/, "The duration follows the live block instead of the previous drop")
  assert.match(liveEdit, /12:05/, "The panel follows the live start time before release")
  assert.match(liveEdit, /13:35/, "The panel follows the live end time before release")
  assert.match(liveEdit, /Bob/, "The panel follows the live team member")
  assert.match(liveEdit, /15\.10\./, "The panel follows the live day")
  const liveSave = [...liveEdit.matchAll(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<\/button>/g)].map(([button]) => button).find((button) => button.includes("Save changes"))
  assert.match(liveSave ?? "", /\sdisabled(?:=|[ >])/, "The preview cannot be saved while the pointer is moving")
  const liveStartsAt = getCalendarTimeRange(liveSelection.day, liveSelection.startMinute, 90, "Europe/Helsinki").startsAt
  const durationQueryKey = options.appointment.list.queryKey({ from: new Date(+liveStartsAt - (240 + booking.services[0].bufferBeforeMinutes) * 60000), to: new Date(+liveStartsAt + (1680 + booking.services[0].bufferAfterMinutes) * 60000), staffMemberId: liveSelection.member.id })
  assertLiveAvailability(durationQueryKey, "Duration checks during a drag", 0)
  render({ ...liveEditOptions, dragging: false })
  assertLiveAvailability(durationQueryKey, "Duration checks after release")
  const liveCreate = render({ url: "/calendar/new?view=week&date=2026-10-14", preview: { startsAt: "2026-10-15T09:05:00Z", endsAt: "2026-10-15T10:35:00Z", member: liveSelection.member, service: { id: "", name: "", color: "#808080" }, preserveScroll: true }, dragging: true, dragUpdate: { selection: liveSelection }, dragSelection: { day: "2026-10-14", member: { id: "alice", name: "Alice" }, startMinute: 605, endMinute: 650 } })
  assertLiveAvailability(options.availability.getBookingTimes.queryKey({ serviceId: undefined, ...liveRange, durationMinutes: 90, selectedStart: getCalendarTimeRange(liveSelection.day, liveSelection.startMinute, 90, "Europe/Helsinki").startsAt }), "Dragging a new booking")
  assert.match(liveCreate, /data-slot="calendar-side-panel"/, "The create panel remains visible during a new drag")
  assert.match(liveCreate, /value="90"/, "The create duration follows the new range before release")
  assert.match(liveCreate, /12:05/, "The create start follows the new range before release")
  assert.equal((liveCreate.match(/data-appointment-id="calendar-booking-draft"/g) ?? []).length, 1, "The new range replaces the old draft block")
  const editingPreview = render({ bookings: [booking], preview: movingPreview })
  assert.match(editingPreview, /data-draft="true"/, "The moved booking remains visible while editing")
  assert.equal((editingPreview.match(/data-appointment-id="saved-booking"/g) ?? []).length, 1, "The moved preview replaces the original instead of duplicating it")
  const editablePreview = render({ url: "/calendar/saved-booking/edit?view=day&date=2026-10-14", bookings: [booking], preview: movingPreview })
  const previewCard = editablePreview.match(/<article\b[^>]*data-appointment-id="saved-booking"[^>]*>/)?.[0] ?? ""
  assert.match(previewCard, /cursor-grab/, "The active preview remains draggable after the edit panel opens")
  assert.match(previewCard, /draggable="false"/, "The preview uses calendar dragging without native browser dragging")
  assert.doesNotMatch(previewCard, /\btitle=/, "Draft previews do not show a native hover tooltip")
  const otherEditable = render({ url: "/calendar/other-booking/edit?view=day&date=2026-10-14", bookings: [booking] })
  const bookingLink = otherEditable.match(/<a\b[^>]*data-appointment-id="saved-booking"[^>]*>/)?.[0] ?? ""
  assert.match(bookingLink, /draggable="false"/, "Saved booking links cannot be dragged by the browser")
  assert.match(bookingLink, /cursor-grab/, "Other bookings remain draggable while a panel is open")
  assert.doesNotMatch(bookingLink, /\btitle=/, "Bookings do not show a native hover tooltip")
  assert.match(bookingLink, /aria-label=/, "Booking details remain available to screen readers")
  assert.match(otherEditable, /data-slot="calendar-booking-resize-handle"/, "Editable bookings expose a bottom resize handle")
  assert.doesNotMatch(otherEditable, /\stitle=/, "Calendar controls and booking details have no native hover labels")
  for (const [link] of otherEditable.matchAll(/<a\b[^>]*>/g)) assert.match(link, /draggable="false"/, "Calendar links disable native dragging")
  assert.doesNotMatch(render({ bookings: [{ ...booking, status: "CANCELLED" }], preview: null }), /data-slot="calendar-booking-resize-handle"/, "Cancelled bookings cannot be resized")
  assert.match(render({ bookings: [booking], preview: null }), /data-appointment-id="saved-booking"/, "Closing without saving restores the original booking")
  for (const service of [{ id: "", name: "", color: "#808080" }, { id: "consultation", name: "Consultation", color: "#30968d" }]) {
    const creationPreview = render({ url: "/calendar/new?view=day&date=2026-10-14", preview: { preserveScroll: true, startsAt: "2026-10-14T09:05:00Z", endsAt: "2026-10-14T09:50:00Z", member: { id: "alice", name: "Alice" }, service } })
    const placeholder = creationPreview.match(/<article\b[^>]*data-appointment-id="calendar-booking-draft"[^>]*>/)?.[0] ?? ""
    assert.match(placeholder, /cursor-grab/, "The create placeholder can be dragged before and after service selection")
    assert.match(placeholder, /draggable="false"/, "The placeholder uses calendar pointer dragging")
    assert.match(placeholder, new RegExp(`--appointment-color:${service.color}`), "Dragging keeps the placeholder's current service color")
    assert.match(creationPreview, /data-slot="calendar-booking-resize-handle"/, "The creation placeholder can also be resized")
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
  const daylightSavingSplit = getCalendarAppointments([{ ...booking, startsAt: "2026-10-24T21:00:00Z", endsAt: "2026-10-25T22:30:00Z" }], [calendarDateFromValue("2026-10-25", "Europe/Helsinki"), calendarDateFromValue("2026-10-26", "Europe/Helsinki")], "Europe/Helsinki")
  assert.deepEqual(daylightSavingSplit.map(({ day, startMinute, endMinute }) => ({ day, startMinute, endMinute })), [
    { day: "2026-10-25", startMinute: 0, endMinute: 1440 },
    { day: "2026-10-26", startMinute: 0, endMinute: 30 },
  ], "Shared date boundaries preserve midnight splits across a 25-hour daylight saving day")
  const normalized = getCalendarAppointments([booking], [calendarDateFromValue("2026-10-14", "Europe/Helsinki")], "Europe/Helsinki")[0]
  for (const status of ["COMPLETED", "NO_SHOW", "CANCELLED"]) {
    const appointment = getCalendarAppointments([{ ...booking, status }], [calendarDateFromValue("2026-10-14", "Europe/Helsinki")], "Europe/Helsinki")[0]
    assert.equal(appointment.movable, status !== "CANCELLED", `${status} bookings expose the correct drag eligibility`)
  }
  const conflictFixtures = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"].map((status) => ({ ...normalized, id: status, status }))
  assert.deepEqual(getCalendarBookingConflicts(conflictFixtures, false).map((appointment) => appointment.id), ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"], "Disabled: active and completed bookings stop calendar dragging")
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
  assert.match(newBooking, /Consultation/, "New bookings suggest an active service")
  assert.doesNotMatch(newBooking, /data-slot="dialog-footer"/, "The booking footer stays hidden until a date is selected")
  const dayWithoutSlot = render({ url: "/calendar/date-selected?view=week&date=2026-10-14" })
  assert.doesNotMatch(dayWithoutSlot, /data-slot="dialog-footer"/, "Selecting a day alone does not show the footer before a time slot is picked")
  assert.doesNotMatch(newBooking, /This view is coming soon/)
  assert.match(newBooking, /href="\/calendar\?view=week&amp;date=2026-10-14"/, "Closing the panel preserves the calendar view and date")
  assert.match(newBooking, /data-slot="week-calendar"/, "The calendar stays rendered beside the booking panel")
  assert.doesNotMatch(newBooking, /role="dialog"|aria-modal|data-slot="(?:sheet|dialog|drawer)-(?:popup|backdrop)"/, "The booking panel renders in the page without a modal or backdrop")
  const shuffled = render({ members: [...staff].reverse() })
  assert.deepEqual([...shuffled.matchAll(/data-slot="calendar-member-heading"[^>]*>[\s\S]*?<span class="truncate">(Alice|Bob)<\/span>/g)].map((match) => match[1]), Array.from({ length: 5 }, () => ["Alice", "Bob"]).flat(), "Header member order stays the same across every day and API response order")
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
  const rows = render({ url: "/calendar?view=day&layout=rows&date=2026-10-14", bookings: [booking], now: Date.parse("2026-10-14T09:00:00Z") })
  const rowsSection = rows.match(/<section\b[^>]*data-layout="rows"[^>]*>/)?.[0] ?? ""
  assert.match(rowsSection, /\binvisible\b/, "Rows server markup hides the unpositioned timeline")
  assert.match(rowsSection, /aria-busy="true"/, "Rows reserve their layout with a loading state until positioning is ready")
  assert.match(rows, /tabler-icon-layout-columns/, "The columns switch has a layout icon")
  assert.match(rows, /tabler-icon-layout-rows/, "The rows switch has a layout icon")
  assert.match(rows, /data-layout="rows"/, "The desktop day offers a horizontal member layout")
  assert.match(rows, /data-slot="calendar-time-header"/, "Hours appear above the member rows")
  assert.equal((rows.match(/data-slot="calendar-member-heading"/g) ?? []).length, 2, "Each team member has a row")
  assert.match(rows, /data-slot="calendar-current-time"[^>]*style="left:/, "The live time line uses a horizontal time position")
  assert.match(rows, /href="[^"]*saved-booking[^"]*layout=rows/, "Opening a booking preserves the selected layout")
  assert.doesNotMatch(render({ url: "/calendar?view=day&layout=rows&date=2026-10-14", now: Date.parse("2026-10-15T09:00:00Z") }), /data-slot="calendar-current-time"/, "The row layout hides the time marker on other dates")
  assert.doesNotMatch(render({ url: "/calendar?view=week&layout=rows&date=2026-10-14" }), /data-layout="rows"/, "The alternative layout only applies to day view")

  const weekTimeFixture = { now: Date.parse("2026-10-14T09:00:00Z"), rules: [{ staffMemberId: null, windows: [window("2026-10-14", 540, 1020)] }] }
  const fullWidthWeek = render({ ...weekTimeFixture, url: "/calendar?view=week&date=2026-10-14" })
  assert.equal((fullWidthWeek.match(/data-slot="calendar-current-time"/g) ?? []).length, 1, "Full-width week view renders one current-time line")
  assert.match(fullWidthWeek, /data-slot="calendar-current-time"[^>]*style="top:[^;]+;left:74px"/, "The full-width week line starts at the time-label edge, like day view")
  assert.doesNotMatch(fullWidthWeek, /aria-label="Full-width time line"/, "The line width is configured by a component prop, without a user setting")
  assert.doesNotMatch(render({ ...weekTimeFixture, url: "/calendar?view=week&date=2026-10-21" }), /data-slot="calendar-current-time"/, "The full-width marker only appears when today is visible")

  const day = render({ url: "/calendar?view=day&date=2026-10-14", bookings: [booking] })
  assert.match(day, /data-slot="day-calendar"/)
  assert.match(day, /aria-label="Day calendar"/)
  assert.equal((day.match(/data-slot="calendar-member-lane"/g) ?? []).length, 2, "Day view renders one lane per bookable member")
  assert.deepEqual([...day.matchAll(/data-slot="calendar-member-heading"[^>]*>[\s\S]*?<span class="truncate">(Alice|Bob)<\/span>/g)].map((match) => match[1]), ["Alice", "Bob"], "Day view retains the staff headings")
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
  assert.match(render({ url: "/calendar?view=list&date=2026-10-14" }), /No bookings this week/, "List view shows a clear empty week")
  const agendaBookings = [
    { ...booking, id: "later-booking", startsAt: new Date("2026-10-14T10:00:00Z"), endsAt: new Date("2026-10-14T10:30:00Z"), status: "CANCELLED" as const },
    booking,
    { ...booking, id: "next-day-booking", startsAt: new Date("2026-10-15T10:00:00Z"), endsAt: new Date("2026-10-15T10:30:00Z"), staffMember: { id: "bob", name: "Bob" } },
    { ...booking, id: "unassigned-booking", startsAt: new Date("2026-10-16T10:00:00Z"), endsAt: new Date("2026-10-16T10:30:00Z"), staffMember: null },
  ]
  const agenda = render({ url: "/calendar?view=list&date=2026-10-14", now: +new Date("2026-10-14T09:00:00Z"), bookings: agendaBookings })
  assert.match(agenda, /data-slot="calendar-agenda"/, "List renders the agenda")
  for (const [link] of agenda.matchAll(/<a\b[^>]*>/g)) assert.match(link, /draggable="false"/, "Agenda links disable native dragging")
  assert.equal((agenda.match(/id="agenda-2026-/g) ?? []).length, 7, "The agenda includes all seven days, including quiet days and weekends")
  assert.equal((agenda.match(/data-slot="calendar-agenda-booking"/g) ?? []).length, 4, "Every booking is shown")
  assert.ok(agenda.indexOf('data-appointment-id="saved-booking"') < agenda.indexOf('data-appointment-id="later-booking"'), "Bookings are sorted by time within each day")
  assert.match(agenda, /2 bookings/, "Date headings include a booking count")
  assert.match(agenda, /Today/, "Today's date is marked")
  assert.match(agenda, /Unassigned/, "Bookings without a team member remain visible")
  assert.match(agenda, /data-status="CANCELLED"/, "Cancelled bookings stay in the agenda")
  assert.match(agenda, /Cancelled/, "Cancelled bookings have a readable status")
  assert.match(agenda, /href="\/calendar\/saved-booking\/edit\?view=list&amp;date=2026-10-14"/, "Booking links preserve agenda state")
  assert.match(renderHeader(agenda), /aria-label="Choose week"/, "Mobile list navigation uses a week picker")
  assert.match(renderHeader(agenda), /aria-label="Next week"/, "Mobile list arrows navigate by week")
  const filteredAgenda = render({ url: "/calendar?view=list&date=2026-10-14&member=bob", bookings: agendaBookings })
  assert.match(filteredAgenda, /data-appointment-id="next-day-booking"/, "The chosen member's booking is visible")
  assert.doesNotMatch(filteredAgenda, /data-appointment-id="saved-booking"|data-appointment-id="unassigned-booking"/, "The member filter excludes other bookings")
  const agendaPanel = render({ url: "/calendar/saved-booking/edit?view=list&date=2026-10-14", bookings: [booking] })
  assert.match(agendaPanel, /data-slot="calendar-agenda"/, "The agenda remains mounted beside the editor")
  assert.match(agendaPanel, /data-slot="calendar-side-panel"/, "Agenda bookings use the existing editor")
  assert.match(agendaPanel, /aria-current="true"/, "The open booking is marked in the agenda")
  const flaggedBooking: Booking = { ...booking, availabilityIssues: ["outsideWorkingHours", "overlapsBreak"] }
  for (const view of ["week", "day", "day&layout=rows", "list"]) {
    const flagged = render({ url: `/calendar?date=2026-10-14&view=${view}`, bookings: [flaggedBooking] })
    assert.ok(flagged.includes('data-slot="calendar-booking-issue-marker"'), `${view} shows an exclamation mark on bookings with issues`)
  }
  const issueRules = [
    { staffMemberId: null, windows: [window("2026-10-14", 540, 1020)] },
    { staffMemberId: "alice", isBreak: true, windows: [window("2026-10-14", 510, 540)] },
  ]
  const issuesPanel = render({ url: "/calendar/saved-booking/edit?view=day&date=2026-10-14", bookings: [flaggedBooking], rules: issueRules, now: Date.parse("2026-10-01T00:00:00Z") })
  assert.ok(issuesPanel.includes('data-slot="calendar-booking-issues"'))
  assert.ok(issuesPanel.includes("This booking is outside the member’s working hours"))
  assert.ok(issuesPanel.includes("This booking overlaps the member’s break"))
  assert.ok(issuesPanel.indexOf('data-slot="calendar-booking-issues"') < issuesPanel.indexOf('data-slot="field"'), "Booking issues appear before all form fields")
  const liveRules = [
    { staffMemberId: null, windows: [window("2026-10-14", 540, 1020)] },
    { staffMemberId: "alice", isBreak: true, windows: [window("2026-10-14", 510, 540)] },
  ]
  const movedToValid = { day: "2026-10-14", member: { id: "bob", name: "Bob" }, startMinute: 600, endMinute: 660 }
  const validPreview = { appointmentId: booking.id, status: "CONFIRMED", startsAt: "2026-10-14T07:00:00Z", endsAt: "2026-10-14T08:00:00Z", member: movedToValid.member, service: { id: "consultation", name: "Consultation", color: "#30968d" } }
  const resolvedPanel = render({ url: "/calendar/saved-booking/edit?view=day&date=2026-10-14", bookings: [flaggedBooking], rules: liveRules, preview: validPreview, dragUpdate: { appointmentId: booking.id, selection: movedToValid }, now: Date.parse("2026-10-01T00:00:00Z") })
  assert.ok(!resolvedPanel.includes('data-slot="calendar-booking-issues"'), "The issue panel clears saved warnings at the preview's valid target position")
  assert.ok(!resolvedPanel.includes('data-slot="calendar-booking-issue-marker"'), "The preview card clears saved warnings at its valid target position")
  const movedToInvalid = { ...movedToValid, member: { id: "alice", name: "Alice" }, startMinute: 520, endMinute: 550 }
  const invalidPreview = { ...validPreview, startsAt: "2026-10-14T05:40:00Z", endsAt: "2026-10-14T06:10:00Z", member: movedToInvalid.member }
  const newIssuesPanel = render({ url: "/calendar/saved-booking/edit?view=day&date=2026-10-14", bookings: [{ ...booking, availabilityIssues: [] }], rules: liveRules, preview: invalidPreview, dragUpdate: { appointmentId: booking.id, selection: movedToInvalid }, now: Date.parse("2026-10-01T00:00:00Z") })
  assert.ok(newIssuesPanel.includes('data-slot="calendar-booking-issues"'), "The panel detects issues at an unsaved target even when the saved booking has no issues")
  assert.ok(newIssuesPanel.includes('data-slot="calendar-booking-issue-marker"'), "The preview card shows newly introduced issues")
  const breakRules = [
    { staffMemberId: null, windows: [window("2026-10-14", 540, 1020)] },
    { staffMemberId: "alice", isBreak: true, windows: [window("2026-10-14", 720, 750)] },
  ]
  for (const url of ["/calendar?view=week&date=2026-10-14", "/calendar?view=day&date=2026-10-14", "/calendar?view=day&date=2026-10-14&layout=rows"]) {
    const withBreak = render({ url, rules: breakRules })
    const cards = withBreak.match(/<article[^>]*data-slot="calendar-break"[^>]*>[\s\S]*?<\/article>/g) ?? []
    assert.equal(cards.length, 1, "Each calendar layout renders a personal break only on its member's lane")
    assert.match(cards[0], /aria-label="Break · 12:00 – 12:30"/)
    assert.match(cards[0], /draggable="false"/)
    assert.doesNotMatch(cards[0], /href=|data-appointment-id|calendar-booking-resize-handle|cursor-grab/, "Break cards cannot open a booking or be moved or resized")
  }
  await i18n.changeLanguage("fi")
  const finnishAgenda = render({ url: "/calendar?view=list&date=2026-10-14", bookings: agendaBookings })
  assert.match(finnishAgenda, /2 varausta/, "Booking counts are translated into Finnish")
  assert.match(finnishAgenda, /Peruttu/, "Booking statuses are translated into Finnish")
  await i18n.changeLanguage("en")
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
  const memberWeekNow = Date.parse("2026-10-14T09:30:00Z")
  for (const workingDay of ["2026-10-12", "2026-10-20"]) {
    const memberWeek = render({
      now: memberWeekNow,
      url: `/calendar?view=week&member=alice&date=${workingDay}`,
      currentMemberId: "membership-alice",
      rules: [{ staffMemberId: "alice", windows: [window(workingDay, 540, 1020)] }],
    })
    const section = memberWeek.match(/<section\b[^>]*data-slot="week-calendar"[^>]*>/)?.[0] ?? ""
    assert.match(section, /aria-busy="true"/, "A member's week waits for positioning even when today is not one of their working days")
    assert.match(section, /\binvisible\b/, "The initial render never exposes a member week before its viewport is ready")
    assert.equal((memberWeek.match(/data-slot="calendar-member-lane"/g) ?? []).length, 1, "A member's initial week already contains only their working days")
    assert.match(memberWeek, /data-slot="calendar-grid" style="width:100%;min-width:208px/, "The member grid fills its container from the server render and keeps a minimum for narrow screens")
    assert.match(memberWeek, /class="grid" style="width:100%;min-width:208px/, "Member headers and bookings use the same responsive column width before hydration")
  }
  const futureWeek = render({ now: memberWeekNow, url: "/calendar?view=week&date=2026-10-21" })
  const futureWeekSection = futureWeek.match(/<section\b[^>]*data-slot="week-calendar"[^>]*>/)?.[0] ?? ""
  assert.match(futureWeekSection, /aria-busy="true"/, "A future team week also waits for its viewport before revealing the grid")
  const elapsedWeekOptions = { now: +new Date("2026-10-14T09:30:00Z"), url: "/calendar?view=week&date=2026-10-14" }
  const elapsedWeek = render(elapsedWeekOptions)
  const pastTimeBlocks = [...elapsedWeek.matchAll(/data-day="([^"]+)" data-slot="calendar-past-time" style="height:(\d+)px"/g)].map((match) => [match[1], Number(match[2])])
  assert.deepEqual(pastTimeBlocks, [], "Past times have the same appearance as future times")
  const currentDateHeading = elapsedWeek.match(/<time\b[^>]*aria-current="date"[^>]*>/)?.[0] ?? ""
  assert.ok(currentDateHeading, "Today retains its accessible current-date marker")
  assert.match(currentDateHeading, /bg-primary text-primary-foreground/, "Today has a visible date badge in the week header")
  const otherDateHeadings = [...elapsedWeek.matchAll(/<time\b[^>]*dateTime="2026-10-(?:12|13|15|16)"[^>]*>/g)]
  assert.ok(otherDateHeadings.length > 0)
  for (const [heading] of otherDateHeadings) assert.doesNotMatch(heading, /bg-primary/, "Only today has a filled date badge")
  const beforeOpening = render({ ...elapsedWeekOptions, now: +new Date("2026-10-14T05:00:00Z") })
  assert.doesNotMatch(beforeOpening, /data-day="2026-10-14" data-slot="calendar-past-time"/, "Today's hours are not shaded before opening")
  const afterClosing = render({ ...elapsedWeekOptions, now: +new Date("2026-10-14T18:00:00Z") })
  assert.doesNotMatch(afterClosing, /data-slot="calendar-past-time"/, "Past days remain visually available after closing")
  assert.doesNotMatch(render({ ...elapsedWeekOptions, url: "/calendar?view=week&date=2026-10-21" }), /data-slot="calendar-past-time"/, "Future weeks have no elapsed shading")
  assert.doesNotMatch(render({ ...elapsedWeekOptions, url: "/calendar?view=day&date=2026-10-14" }), /data-slot="calendar-past-time"/, "Elapsed shading is limited to week view")
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
  const memberSelectMarkup = (markup: string) => markup.slice(markup.indexOf("</header>") + "</header>".length).match(/<div\b[^>]*data-slot="calendar-member-select"[^>]*>([\s\S]*?)<\/button>/)?.[1] ?? ""
  assert.match(memberSelectMarkup(render()), />Whole team</, "The member select defaults to all team members")
  const pendingMemberSelect = memberSelectMarkup(render({ membersPending: true }))
  assert.match(pendingMemberSelect, /data-slot="skeleton"/, "Uncached members show a skeleton instead of a blank selection")
  assert.match(pendingMemberSelect, /disabled/, "Member selection waits for the member list")
  assert.match(memberSelectMarkup(render({ url: "/calendar?view=day&date=2026-10-14&member=alice" })), />Alice</, "The selected name is visible immediately once members are cached")
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
      for (const [mode, option] of [["day", ""], ["week", ""], ["day", "&layout=rows"]] as const) {
        const markup = render({ url: `/calendar?view=${mode}&date=2026-10-14${option}`, rules: [{ staffMemberId: null, windows: [window("2026-10-14", 540, 1020)] }] })
        assert.equal(markup.includes('data-slot="calendar-current-time"'), visible, `${mode} shows the line only from five minutes after opening until five minutes before closing`)
        assert.equal(markup.includes('data-slot="calendar-current-time-label"'), visible, "The time label follows the same cutoff as the line")
        if (visible) {
          const labelIndex = markup.indexOf('data-slot="calendar-current-time-label"')
          if (option === "&layout=rows") assert.ok(labelIndex < markup.indexOf('data-slot="calendar-grid"'), "Rows keep the current time label in the fixed header")
          else assert.ok(labelIndex > markup.indexOf('data-slot="calendar-time-gutter"') && labelIndex < markup.indexOf('data-slot="calendar-grid"'), `${mode} keeps the current time pill in the fixed gutter outside the clipped scrolling grid`)
          assert.equal((markup.match(/data-slot="calendar-current-time-label"/g) ?? []).length, 1, "Each view renders exactly one current time label")
        }
      }
    }
  } finally {
    mock.timers.reset()
  }
  mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-14T06:59:59Z") })
  try {
    const now = Date.now()
    for (const mode of ["day", "week"]) {
      const fixture = { now, url: `/calendar?view=${mode}`, rules: [{ staffMemberId: null, windows: [window("2026-10-14", 540, 1020)] }] }
      mock.timers.setTime(now)
      const serverMarkup = render(fixture)
      mock.timers.setTime(now + 2_000)
      assert.equal(render(fixture), serverMarkup, `${mode} hydration keeps the server clock when the minute changes`)
      mock.timers.setTime(Date.parse("2026-10-15T21:01:00Z"))
      assert.equal(render(fixture), serverMarkup, `${mode} hydration keeps the selected date and relative labels when the day changes`)
    }
  } finally {
    mock.timers.reset()
  }
  const { CalendarTimeline } = await vite.ssrLoadModule("/app/components/calendar/calendar-timeline.tsx") as typeof import("../app/components/calendar/calendar-timeline")
  const mobileDay = calendarDateFromValue("2026-10-14", "Europe/Helsinki")
  const renderTimeline = (mobile: boolean, clock = "2026-10-14T09:30:00Z", date = mobileDay, withBookings = true, week = false, fullWidthTimeLine = false) => {
    const router = createMemoryRouter([{ path: "/calendar", element: createElement(CalendarTimeline, {
      expandToContent: mobile, initialNow: Date.parse(clock), viewMode: week ? "week" : "day", fullWidthTimeLine, trimTimeEdges: true,
      days: week ? [calendarDateFromValue("2026-10-13", "Europe/Helsinki"), date, calendarDateFromValue("2026-10-15", "Europe/Helsinki")] : [date], members: [{ id: "alice", name: "Alice" }], startMinute: 540, endMinute: 1020,
      timeZone: "Europe/Helsinki", formatPreference: "eu",
      unavailableTimes: [{ day: "2026-10-14", memberId: "alice", startMinute: 540, endMinute: 600 }],
      breaks: [{ day: "2026-10-14", memberId: "alice", startMinute: 780, endMinute: 810 }],
      appointments: withBookings ? [{ id: "mobile-booking", day: "2026-10-14", memberId: "alice", customerName: "Aino Virtanen", startMinute: 720, endMinute: 780, service: { id: "consultation", name: "Consultation", color: "#30968d" } }] : [],
    }) }], { initialEntries: ["/calendar"] })
    try {
      return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(RouterProvider, { router })))
    } finally {
      router.dispose()
    }
  }
  const todayOnlyWeek = renderTimeline(false, "2026-10-14T09:30:00Z", mobileDay, true, true)
  assert.match(todayOnlyWeek, /data-slot="calendar-current-time"[^>]*style="top:[^;]+;left:[^;]+%;width:[^;]+%/, "The default component prop confines the week line to today")
  const fullWeek = renderTimeline(false, "2026-10-14T09:30:00Z", mobileDay, true, true, true)
  assert.match(fullWeek, /data-slot="calendar-current-time"[^>]*style="top:[^;]+;left:74px"/, "The component prop enables a full-width line connected to the label")
  for (const fullWidth of [false, true]) {
    for (const [time, visible] of [["06:04", false], ["06:05", true], ["13:55", true], ["13:56", false]] as const) {
      const markup = renderTimeline(false, `2026-10-14T${time}:00Z`, mobileDay, true, true, fullWidth)
      assert.equal(markup.includes('data-slot="calendar-current-time"'), visible, "Both week line widths respect the five-minute cutoff")
      assert.equal(markup.includes('data-slot="calendar-current-time-label"'), visible, "The time label hides together with the line")
    }
  }
  const mobileTimeline = renderTimeline(true)
  assert.match(mobileTimeline, /data-slot="calendar-break"/, "Mobile day renders fixed break cards")
  assert.match(mobileTimeline, /data-presentation="mobile"/, "The expanded mobile day uses the simple timeline presentation")
  assert.doesNotMatch(mobileTimeline, /data-slot="calendar-(?:header|date-row|vertical-scroll|horizontal-scroll|unavailable-lane)"/, "Mobile renders no date or member headings, scrollbar tracks, or unavailable shading")
  assert.match(mobileTimeline, /data-slot="calendar-grid" style="width:100%/, "The mobile timeline fills the available width without a horizontal minimum")
  assert.equal((mobileTimeline.match(/data-slot="calendar-hour-line"/g) ?? []).length, 9, "The mobile timeline includes every hourly line from opening to closing")
  assert.match(mobileTimeline, />0?9:00</, "The mobile timeline labels its opening hour")
  assert.match(mobileTimeline, />17:00</, "The mobile timeline labels its closing hour")
  assert.match(mobileTimeline, /data-appointment-id="mobile-booking"/, "Mobile retains positioned booking cards")
  assert.match(mobileTimeline, /href="\/calendar\/mobile-booking\/edit"/, "Mobile bookings still open the edit flow")
  assert.match(mobileTimeline, /data-slot="calendar-current-time"[^>]*style="top:456px/, "The current time line uses the same vertical scale as the bookings")
  assert.match(mobileTimeline, /data-slot="calendar-current-time-label"/, "Mobile retains the current time label")
  assert.equal((mobileTimeline.match(/data-slot="calendar-current-time"/g) ?? []).length, 1, "Mobile uses one continuous current time line")
  assert.match(mobileTimeline, /data-slot="calendar-current-time"[^>]*style="top:456px;left:44px"/, "The mobile line starts at the pill edge and spans the gutter gap and booking area")
  assert.doesNotMatch(mobileTimeline, /after:bg-red-500/, "The pill has no separate connector line")
  assert.match(mobileTimeline, />12:30</, "The current time uses the business timezone")
  const emptyMobileTimeline = renderTimeline(true, "2026-10-14T09:30:00Z", mobileDay, false)
  assert.match(emptyMobileTimeline, /data-slot="calendar-hour-line"/, "An empty mobile day still has its timeline")
  assert.match(emptyMobileTimeline, /data-slot="calendar-current-time"/, "An empty mobile day still shows the current time")
  assert.doesNotMatch(renderTimeline(true, "2026-10-14T18:00:00Z"), /data-slot="calendar-current-time"/, "The current time line stays within the displayed hours")
  assert.doesNotMatch(renderTimeline(true, "2026-10-14T09:30:00Z", calendarDateFromValue("2026-10-15", "Europe/Helsinki")), /data-slot="calendar-current-time"/, "Other dates do not show today's current time line")
  const desktopTimeline = renderTimeline(false)
  assert.equal((desktopTimeline.match(/data-slot="calendar-current-time"/g) ?? []).length, 1, "Desktop day uses one continuous current time line, like mobile")
  assert.match(desktopTimeline, /data-slot="calendar-current-time"[^>]*style="top:456px;left:74px"/, "The desktop day line begins at the pill edge without moving the pill")
  const desktopCurrentLine = desktopTimeline.match(/<div[^>]*data-slot="calendar-current-time"[^>]*>/)?.[0] ?? ""
  assert.match(desktopCurrentLine, /right-\[19px\]/, "The desktop day line ends before the scrollbar track")
  for (const slot of ["calendar-header", "calendar-date-row", "calendar-vertical-scroll", "calendar-horizontal-scroll", "calendar-unavailable-lane"]) {
    assert.ok(desktopTimeline.includes(`data-slot="${slot}"`), `Desktop retains ${slot}`)
  }
  console.log("Calendar timeline checks passed")
} finally {
  queryClient.clear()
  await vite.close()
}
