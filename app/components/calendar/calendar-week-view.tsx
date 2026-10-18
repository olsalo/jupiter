import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useLocation, useMatch, useNavigate } from "react-router"
import { useOrganizationPermission } from "~/lib/use-organization-access"
import { useTranslation } from "react-i18next"

import { useCalendarState } from "~/components/calendar/use-calendar-state"
import { useCalendarBookingPreview } from "~/components/calendar/calendar-booking-preview"
import { WeekCalendar, type CalendarMember } from "~/components/calendar/week-calendar"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { useTRPC } from "~/lib/trpc/client"
import { recordCalendarBookingVersion } from "~/lib/calendar-booking-cache"
import { calendarBookingsQueryOptions, calendarReferenceQueryOptions } from "~/lib/calendar-query"
import { getWeekCalendarSchedule } from "~/lib/calendar-schedule"
import { getCalendarBookingRange, getCalendarTimeRange } from "~/lib/calendar-date"
import { getCalendarAppointments, unassignedCalendarMemberId } from "~/lib/calendar-appointments"

export function CalendarWeekView() {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const editMatch = useMatch("/calendar/:appointmentId/edit")
  const isEditOpen = editMatch !== null
  const canEdit = useOrganizationPermission({ appointments: ["update"] })
  const canCreate = useOrganizationPermission({ appointments: ["create"] })
  const { preview: bookingPreview, setPreview, setDragUpdate, dragging } = useCalendarBookingPreview()
  const state = useCalendarState()
  const { organization, staff, bookableMembers, selectedMember, mode, selected, startMinute, endMinute, timeZone, formatPreference } = state
  const preview = bookingPreview && (!selectedMember || bookingPreview.member.id === selectedMember.id) ? bookingPreview : null
  const isCreateFlow = location.pathname === "/calendar/new" || (location.pathname === "/calendar" && Boolean(bookingPreview && !bookingPreview.appointmentId))
  const days = mode === "day" ? [selected] : state.days
  const range = getCalendarBookingRange(state, timeZone)
  const scheduleQuery = useQuery({ ...trpc.availability.calendarSchedule.queryOptions(range), ...calendarReferenceQueryOptions })
  const interacting = Boolean(dragging || bookingPreview || isEditOpen || location.pathname === "/calendar/new")
  const bookings = useQuery({ ...trpc.appointment.list.queryOptions(range), ...calendarBookingsQueryOptions(interacting) })
  const rangeKey = `${range.from.toISOString()}/${range.to.toISOString()}`
  const bookingVersion = bookings.data ? JSON.stringify(bookings.data) : null
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

  if (showLoadError) return <Alert variant="error">
    <AlertTitle>{t("calendarGrid.loadError")}</AlertTitle>
    <AlertDescription>{t("retryDescription")}</AlertDescription>
    <AlertAction><Button disabled={isFetching} onClick={retry} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction>
  </Alert>

  if (organization.data === undefined || staff.data === undefined || scheduleQuery.data === undefined || bookings.data === undefined) return <div className="flex min-h-0 flex-1 items-center justify-center bg-background"><Spinner aria-label={t("loading")} /></div>

  const members = selectedMember ? [selectedMember] : bookableMembers
  const visibleBookings = selectedMember ? bookings.data.filter((booking) => booking.staffMember?.id === selectedMember.id) : bookings.data
  const savedAppointments = getCalendarAppointments(visibleBookings, days, timeZone)
  const appointments = savedAppointments.filter((appointment) => appointment.id !== preview?.appointmentId).map((appointment) => ({ ...appointment, movable: appointment.movable && canEdit }))
  if (preview) appointments.push(...getCalendarAppointments([{
    id: preview.appointmentId ?? "calendar-booking-draft",
    startsAt: preview.startsAt,
    endsAt: preview.endsAt,
    status: preview.status ?? "",
    customer: { firstName: preview.customerName ?? t("calendarGrid.draftBooking"), lastName: null },
    staffMember: preview.member,
    services: [{ serviceId: preview.service.id, name: preview.service.name, service: { color: preview.service.color } }],
  }], days, timeZone).map((appointment) => ({ ...appointment, draft: true, creationDraft: !preview.appointmentId, movable: preview.appointmentId ? appointment.movable && canEdit : canCreate && isCreateFlow })))
  // A preview has not moved the saved booking yet, so keep both times reserved
  const conflictAppointments = [
    ...getCalendarAppointments(bookings.data, days, timeZone),
    ...appointments.filter((appointment) => appointment.draft),
  ]
  const calendarMembers: CalendarMember[] = [...members]
  if (preview && !calendarMembers.some((member) => member.id === preview.member.id)) calendarMembers.push(preview.member)
  for (const booking of visibleBookings) {
    const member = booking.staffMember ?? { id: unassignedCalendarMemberId, name: t("calendarGrid.unassigned") }
    if (!calendarMembers.some((item) => item.id === member.id)) calendarMembers.push(staff.data.find((item) => item.id === member.id) ?? member)
  }
  const schedule = getWeekCalendarSchedule({ days, members: calendarMembers, rules: scheduleQuery.data, timeZone, defaultStartMinute: startMinute, defaultEndMinute: endMinute, appointments: [...savedAppointments, ...appointments.filter((appointment) => appointment.draft)], includeBusinessHours: selectedMember === undefined })

  return <div className="flex min-h-0 flex-1 flex-col gap-3">
    {showRefreshError ? <Alert variant="warning"><AlertTitle>{t("calendarGrid.refreshError")}</AlertTitle><AlertDescription>{t("calendarGrid.staleDescription")}</AlertDescription><AlertAction><Button disabled={isFetching} onClick={retry} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : null}
    {calendarMembers.length === 0 ? <Alert variant="info"><AlertTitle>{t("calendarGrid.noMembers")}</AlertTitle><AlertDescription>{t("calendarGrid.noMembersDescription")}</AlertDescription></Alert> : null}
    <WeekCalendar focusedAppointmentId={preview ? preview.appointmentId ?? "calendar-booking-draft" : editMatch?.params.appointmentId} onMoveBooking={(canEdit && (location.pathname === "/calendar" || location.pathname === "/calendar/new" || isEditOpen)) || (canCreate && isCreateFlow) ? (appointment, dragSelection, phase) => {
      if (phase === "start" && (appointment.creationDraft || bookingPreview?.appointmentId === appointment.id || (!bookingPreview && editMatch?.params.appointmentId === appointment.id))) return
      const member = dragSelection.member
      const range = getCalendarTimeRange(dragSelection.day, dragSelection.startMinute, dragSelection.endMinute - dragSelection.startMinute, timeZone)
      if (appointment.creationDraft) {
        if (!canCreate || !isCreateFlow) return
        setPreview((current) => current && !current.appointmentId ? { ...current, preserveScroll: true, startsAt: range.startsAt.toISOString(), endsAt: range.endsAt.toISOString(), member } : current)
        setDragUpdate?.({ selection: { ...dragSelection, member } })
        return
      }
      if (!canEdit) return
      setPreview({ preserveScroll: true, appointmentId: appointment.id, status: appointment.status, customerName: appointment.customerName, startsAt: range.startsAt.toISOString(), endsAt: range.endsAt.toISOString(), member, service: appointment.service })
      setDragUpdate?.({ appointmentId: appointment.id, selection: { ...dragSelection, member } })
      const editPath = `/calendar/${encodeURIComponent(appointment.id)}/edit`
      if (location.pathname !== editPath) void navigate(`${editPath}${location.search}`, { replace: isEditOpen || location.pathname === "/calendar/new", preventScrollReset: true, state: { draggedBooking: { ...dragSelection, member, appointmentId: appointment.id } } })
    } : undefined} allowSimultaneousBookings={organization.data.settings?.allowSimultaneousBookings === true} onSelectRange={canCreate && location.pathname === "/calendar" ? (dragSelection) => {
      const range = getCalendarTimeRange(dragSelection.day, dragSelection.startMinute, dragSelection.endMinute - dragSelection.startMinute, timeZone)
      setPreview({ preserveScroll: true, startsAt: range.startsAt.toISOString(), endsAt: range.endsAt.toISOString(), member: dragSelection.member, service: { id: "", name: "", color: "#808080" } })
      setDragUpdate?.({ selection: dragSelection })
      void navigate(`/calendar/new${location.search}`, { preventScrollReset: true, state: { dragSelection } })
    } : undefined} bookingMembers={bookableMembers} appointments={appointments} conflictAppointments={conflictAppointments} className="rounded-none border-0" days={schedule.days} endMinute={schedule.endMinute} formatPreference={formatPreference} key={selectedMember?.id ?? "team"} members={calendarMembers} startMinute={schedule.startMinute} timeZone={timeZone} trimTimeEdges={true} unavailableTimes={schedule.unavailableTimes} viewMode={mode === "day" ? "day" : "week"} />
  </div>
}
