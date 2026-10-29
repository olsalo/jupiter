import type { CalendarAppointment, CalendarDragSelection, CalendarMember } from "~/lib/calendar/types"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useLocation, useMatch, useNavigate } from "react-router"
import { useOrganizationPermission } from "~/lib/hooks/use-organization-access"
import { useTranslation } from "react-i18next"

import { useCalendarState } from "~/components/calendar/use-calendar-state"
import { useCalendarBookingPreview } from "~/components/calendar/calendar-booking-preview"
import { CalendarMemberRows } from "~/components/calendar/calendar-member-rows"
import { CalendarTimeline } from "~/components/calendar/calendar-timeline"
import { CalendarView } from "~/components/calendar/calendar-view"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { useTRPC } from "~/lib/trpc/client"
import { recordCalendarBookingVersion } from "~/lib/calendar/booking-cache"
import { calendarBookingsQueryOptions, calendarReferenceQueryOptions } from "~/lib/calendar/query-options"
import { getCalendarAppointmentPosition, getCalendarPreviewIssues } from "~/lib/calendar/preview-issues"
import { calendarIntervalMinutes, calendarMinDurationMinutes } from "~/lib/calendar/time-step"
import { getCalendarSchedule } from "~/lib/calendar/schedule"
import { getCalendarBookingRange, getCalendarTimeRange } from "~/lib/calendar/date"
import { getCalendarDraftService } from "~/lib/calendar/booking-service-suggestion"
import { getCalendarAppointments, unassignedCalendarMemberId } from "~/lib/calendar/appointments"

export function CalendarSchedule() {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const editMatch = useMatch("/calendar/:appointmentId/edit")
  const isEditOpen = editMatch !== null
  const canEdit = useOrganizationPermission({ appointments: ["update"] })
  const canCreate = useOrganizationPermission({ appointments: ["create"] })
  const { preview: bookingPreview, setPreview, dragUpdate, setDragUpdate, dragging } = useCalendarBookingPreview()
  const previousCreation = useRef<{ preview: typeof bookingPreview; dragUpdate: typeof dragUpdate } | null>(null)
  const state = useCalendarState()
  const { organization, staff, bookableMembers, selectedMember, mode, selected, startMinute, endMinute, timeZone, formatPreference, now } = state
  const preview = bookingPreview && (!selectedMember || bookingPreview.member.id === selectedMember.id) ? bookingPreview : null
  const isCreateFlow = location.pathname === "/calendar/new" || (location.pathname === "/calendar" && Boolean(bookingPreview && !bookingPreview.appointmentId))
  const days = useMemo(() => mode === "day" ? [selected] : state.days, [mode, selected, state.days])
  const range = getCalendarBookingRange(state, timeZone)
  const services = useQuery({ ...trpc.service.list.queryOptions(), ...calendarReferenceQueryOptions })
  const serviceUsage = useQuery({ ...trpc.service.bookingUsage.queryOptions(), ...calendarReferenceQueryOptions })
  const getDraftService = useCallback((length: number) => {
    const service = getCalendarDraftService(services.data ?? [], serviceUsage.data ?? [], length)
    return service ? { id: service.id, name: service.name, color: service.color ?? "var(--primary)" } : undefined
  }, [services.data, serviceUsage.data])
  const serviceDurations = useMemo(() => services.data?.filter((service) => service.isActive).map((service) => service.durationMinutes), [services.data])
  const scheduleQuery = useQuery({ ...trpc.availability.calendarSchedule.queryOptions(range), ...calendarReferenceQueryOptions })
  const getBookingIssues = useCallback((appointment: CalendarAppointment) => scheduleQuery.data
    ? getCalendarPreviewIssues(getCalendarAppointmentPosition(appointment, timeZone), { rules: scheduleQuery.data, timeZone, defaultStartMinute: startMinute, defaultEndMinute: endMinute, now })
    : appointment.availabilityIssues, [scheduleQuery.data, timeZone, startMinute, endMinute, now])
  const interacting = Boolean(dragging || bookingPreview || isEditOpen || location.pathname === "/calendar/new")
  const bookings = useQuery({ ...trpc.appointment.list.queryOptions({ ...range, includeCancelled: false }), ...calendarBookingsQueryOptions(interacting) })
  const rangeKey = `${range.from.toISOString()}/${range.to.toISOString()}`
  const savedCalendarAppointments = useMemo(() => getCalendarAppointments(bookings.data ?? [], days, timeZone), [bookings.data, days, timeZone])
  const savedAppointments = useMemo(() => selectedMember ? savedCalendarAppointments.filter((appointment) => appointment.memberId === selectedMember.id) : savedCalendarAppointments, [savedCalendarAppointments, selectedMember?.id])
  const bookingVersion = useMemo(() => bookings.data ? JSON.stringify(bookings.data) : null, [bookings.data])
  useEffect(() => {
    if (bookingVersion === null) return
    if (!recordCalendarBookingVersion(queryClient, rangeKey, bookingVersion)) return
    // Availability is reusable until saved booking data actually changes
    void Promise.all([
      queryClient.invalidateQueries({ ...trpc.availability.getBookingTimes.queryFilter(), refetchType: "none" }),
      queryClient.invalidateQueries({ ...trpc.availability.getSlots.queryFilter(), refetchType: "none" }),
      queryClient.invalidateQueries({ ...trpc.appointment.getBookingTimes.queryFilter(), refetchType: "none" }),
      queryClient.invalidateQueries({ ...trpc.appointment.getSlots.queryFilter(), refetchType: "none" }),
      ...(!interacting ? [queryClient.invalidateQueries({ ...trpc.appointment.get.queryFilter(), refetchType: "none" })] : []),
    ])
  }, [bookingVersion, rangeKey, interacting, queryClient, trpc])
  const queries = [organization, staff, scheduleQuery, bookings]
  const showLoadError = queries.some((query) => query.isError && query.data === undefined)
  const showRefreshError = queries.some((query) => query.isError && query.data !== undefined)
  const isFetching = queries.some((query) => query.isFetching)
  const retry = () => void Promise.all(queries.map((query) => query.refetch()))

  const timelineData = useMemo(() => {
    if (bookings.data === undefined || staff.data === undefined || scheduleQuery.data === undefined) return null
    const members = selectedMember ? [selectedMember] : bookableMembers
    const visibleBookings = selectedMember ? bookings.data.filter((booking) => booking.staffMember?.id === selectedMember.id) : bookings.data
    const appointments = savedAppointments.filter((appointment) => appointment.id !== preview?.appointmentId).map((appointment) => ({ ...appointment, movable: appointment.movable && canEdit }))
    if (preview) appointments.push(...getCalendarAppointments([{
      id: preview.appointmentId ?? "calendar-booking-draft",
      startsAt: preview.startsAt,
      endsAt: preview.endsAt,
      status: preview.status ?? "",
      customer: { firstName: preview.customerName ?? t("calendarGrid.draftBooking"), lastName: null },
      staffMember: preview.member,
      location: preview.locationId ? { id: preview.locationId } : bookings.data.find((booking) => booking.id === preview.appointmentId)?.location,
      services: [{ bufferBeforeMinutes: preview.bufferBeforeMinutes, bufferAfterMinutes: preview.bufferAfterMinutes, serviceId: preview.service.id, name: preview.service.name, service: { color: preview.service.color } }],
    }], days, timeZone).map((appointment) => ({ ...appointment, availabilityIssues: getBookingIssues({ ...appointment, status: appointment.status || "CONFIRMED" }), draft: true, creationDraft: !preview.appointmentId, movable: preview.appointmentId ? appointment.movable && canEdit : canCreate && isCreateFlow })))
    // A preview has not moved the saved booking yet, so keep both times reserved
    const conflictAppointments = [
      ...savedCalendarAppointments,
      ...appointments.filter((appointment) => appointment.draft),
    ]
    const calendarMembers: CalendarMember[] = [...members]
    if (preview && !calendarMembers.some((member) => member.id === preview.member.id)) calendarMembers.push(preview.member)
    for (const booking of visibleBookings) {
      const member = booking.staffMember ?? { id: unassignedCalendarMemberId, name: t("calendarGrid.unassigned") }
      if (!calendarMembers.some((item) => item.id === member.id)) calendarMembers.push(staff.data.find((item) => item.id === member.id) ?? member)
    }
    const schedule = getCalendarSchedule({ days, members: calendarMembers, rules: scheduleQuery.data, timeZone, defaultStartMinute: startMinute, defaultEndMinute: endMinute, appointments: [...savedAppointments, ...appointments.filter((appointment) => appointment.draft)], includeBusinessHours: selectedMember === undefined })
    return { calendarMembers, appointments, conflictAppointments, schedule }
  }, [bookings.data, staff.data, scheduleQuery.data, selectedMember, bookableMembers, savedAppointments, savedCalendarAppointments, preview, days, timeZone, startMinute, endMinute, canEdit, canCreate, isCreateFlow, getBookingIssues, t])

  if (showLoadError) return <CalendarView alerts={<Alert variant="error">
    <AlertTitle>{t("calendarGrid.loadError")}</AlertTitle>
    <AlertDescription>{t("retryDescription")}</AlertDescription>
    <AlertAction><Button disabled={isFetching} onClick={retry} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction>
  </Alert>} />

  if (organization.data === undefined || timelineData === null) return <CalendarView><div className="flex min-h-0 flex-1 items-center justify-center bg-background"><Spinner aria-label={t("loading")} /></div></CalendarView>

  const { calendarMembers, appointments, conflictAppointments, schedule } = timelineData

  const updateCreationRange = (dragSelection: CalendarDragSelection) => {
    const range = getCalendarTimeRange(dragSelection.day, dragSelection.startMinute, dragSelection.endMinute - dragSelection.startMinute, timeZone)
    setPreview((current) => ({
      ...(location.pathname === "/calendar/new" && current && !current.appointmentId ? current : {}),
      preserveScroll: true, startsAt: range.startsAt.toISOString(), endsAt: range.endsAt.toISOString(), member: dragSelection.member,
      service: current && !current.appointmentId && (+new Date(current.endsAt) - +new Date(current.startsAt)) / 60000 === dragSelection.endMinute - dragSelection.startMinute
        ? current.service : getDraftService(dragSelection.endMinute - dragSelection.startMinute) ?? { id: "", name: "", color: "#808080" },
    }))
    setDragUpdate?.({ selection: dragSelection })
  }

  const Timeline = mode === "day" && state.dayLayout === "rows" ? CalendarMemberRows : CalendarTimeline

  return <CalendarView alerts={<>
    {showRefreshError ? <Alert variant="warning"><AlertTitle>{t("calendarGrid.refreshError")}</AlertTitle><AlertDescription>{t("calendarGrid.staleDescription")}</AlertDescription><AlertAction><Button disabled={isFetching} onClick={retry} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : null}
    {calendarMembers.length === 0 ? <Alert variant="info"><AlertTitle>{t("calendarGrid.noMembers")}</AlertTitle><AlertDescription>{t("calendarGrid.noMembersDescription")}</AlertDescription></Alert> : null}
  </>}>
    <Timeline getDraftService={getDraftService} serviceDurations={serviceDurations} intervalMinutes={calendarIntervalMinutes} minDurationMinutes={calendarMinDurationMinutes} getBookingIssues={getBookingIssues} fullWidthTimeLine={true} expandToContent={state.isMobile} initialNow={now} focusedAppointmentId={isEditOpen || location.pathname === "/calendar/new" ? preview ? preview.appointmentId ?? "calendar-booking-draft" : editMatch?.params.appointmentId : undefined} onMoveBooking={(canEdit && (location.pathname === "/calendar" || location.pathname === "/calendar/new" || isEditOpen)) || (canCreate && isCreateFlow) ? (appointment, dragSelection, phase) => {
      if (phase !== "drop" && !appointment.creationDraft && !isEditOpen && location.pathname !== "/calendar/new") return
      const member = dragSelection.member
      const range = getCalendarTimeRange(dragSelection.day, dragSelection.startMinute, dragSelection.endMinute - dragSelection.startMinute, timeZone)
      if (appointment.creationDraft) {
        if (!canCreate || !isCreateFlow) return
        setPreview((current) => current && !current.appointmentId ? { ...current, preserveScroll: true, startsAt: range.startsAt.toISOString(), endsAt: range.endsAt.toISOString(), member } : current)
        setDragUpdate?.({ selection: { ...dragSelection, member } })
        return
      }
      if (!canEdit) return
      setPreview({ bufferBeforeMinutes: appointment.bufferBeforeMinutes, bufferAfterMinutes: appointment.bufferAfterMinutes, preserveScroll: true, locationId: appointment.locationId, appointmentId: appointment.id, status: appointment.status, customerName: appointment.customerName, startsAt: range.startsAt.toISOString(), endsAt: range.endsAt.toISOString(), member, service: appointment.service })
      setDragUpdate?.({ appointmentId: appointment.id, selection: { ...dragSelection, member } })
      const editPath = `/calendar/${encodeURIComponent(appointment.id)}/edit`
      if ((phase === "start" || phase === "drop") && location.pathname !== editPath) void navigate(`${editPath}${location.search}`, { replace: isEditOpen || location.pathname === "/calendar/new", preventScrollReset: true, state: { draggedBooking: { ...dragSelection, member, appointmentId: appointment.id } } })
    } : undefined} allowSimultaneousBookings={organization.data.settings?.allowSimultaneousBookings === true} onSelectRangeStart={canCreate ? () => {
      const draft = appointments.find((appointment) => appointment.creationDraft)
      const previousDrag = dragUpdate ?? (draft && bookingPreview ? { selection: { day: draft.day, member: bookingPreview.member, startMinute: draft.startMinute, endMinute: draft.endMinute } } : null)
      previousCreation.current = location.pathname === "/calendar/new" ? { preview: bookingPreview, dragUpdate: previousDrag } : null
      // Keep the captured lane mounted until drop, including when replacing an editor
      if (location.pathname !== "/calendar/new") setPreview(null)
    } : undefined} onSelectRangeUpdate={canCreate && location.pathname === "/calendar/new" ? updateCreationRange : undefined} onSelectRangeCancel={() => {
      const previous = previousCreation.current
      previousCreation.current = null
      if (!previous) return
      setPreview(previous.preview)
      setDragUpdate?.(previous.dragUpdate ?? null)
    }} onSelectRange={canCreate && (location.pathname === "/calendar" || location.pathname === "/calendar/new" || isEditOpen) ? (dragSelection) => {
      previousCreation.current = null
      updateCreationRange(dragSelection)
      if (location.pathname !== "/calendar/new") void navigate(`/calendar/new${location.search}`, { replace: isEditOpen, preventScrollReset: true, state: { dragSelection } })
    } : undefined} bookingMembers={bookableMembers} appointments={appointments} conflictAppointments={conflictAppointments} className="rounded-none border-0" days={schedule.days} endMinute={schedule.endMinute} formatPreference={formatPreference} key={selectedMember?.id ?? "team"} members={calendarMembers} startMinute={schedule.startMinute} timeZone={timeZone} trimTimeEdges={true} breaks={schedule.breaks} unavailableTimes={schedule.unavailableTimes} viewMode={mode === "day" ? "day" : "week"} />
  </CalendarView>
}
