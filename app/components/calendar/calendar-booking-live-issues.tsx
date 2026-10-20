import { useQuery } from "@tanstack/react-query"
import { useSyncExternalStore } from "react"
import { TZDate } from "react-day-picker"

import { CalendarBookingIssues } from "~/components/calendar/calendar-booking-issues"
import { useCalendarBookingPreview } from "~/components/calendar/calendar-booking-preview"
import { useCalendarState } from "~/components/calendar/use-calendar-state"
import { calendarDateToValue, getCalendarBookingRange, getCalendarDateState } from "~/lib/calendar/date"
import { getCalendarAppointmentPosition, getCalendarPreviewIssues } from "~/lib/calendar/preview-issues"
import { calendarReferenceQueryOptions } from "~/lib/calendar/query-options"
import type { BookingAvailabilityIssue } from "~/lib/calendar/booking-issues"
import { useTRPC } from "~/lib/trpc/client"

type BookingPosition = Parameters<typeof getCalendarPreviewIssues>[0]
const subscribeToNothing = () => () => {}
const noDrag = () => null

// Only this warning subscribes to pointer frames, keeping the booking form stable
export function CalendarBookingLiveIssues({ appointmentId, savedPosition, position = savedPosition, savedIssues }: {
  appointmentId: string
  savedPosition: BookingPosition
  position?: BookingPosition
  savedIssues?: BookingAvailabilityIssue[]
}) {
  const trpc = useTRPC()
  const calendar = useCalendarState()
  const { liveDragPreview } = useCalendarBookingPreview()
  const dragged = useSyncExternalStore(liveDragPreview?.subscribe ?? subscribeToNothing, () => liveDragPreview?.getSnapshot()?.appointment ?? null, noDrag)
  const current = dragged?.id === appointmentId ? getCalendarAppointmentPosition(dragged, calendar.timeZone) : position
  const params = new URLSearchParams(calendar.searchParams)
  params.set("date", calendarDateToValue(new TZDate(+new Date(current.startsAt), calendar.timeZone)))
  params.set("view", calendar.mode)
  const state = getCalendarDateState(params, { timeZone: calendar.timeZone, weekStartsOn: calendar.weekStartsOn, now: calendar.now })
  const bookingRange = getCalendarBookingRange(state, calendar.timeZone)
  const range = { from: bookingRange.from, to: new Date(Math.max(+bookingRange.to, +new Date(current.endsAt))) }
  const schedule = useQuery({ ...trpc.availability.calendarSchedule.queryOptions(range), ...calendarReferenceQueryOptions })
  const isSavedPosition = +new Date(current.startsAt) === +new Date(savedPosition.startsAt) && +new Date(current.endsAt) === +new Date(savedPosition.endsAt) && current.memberId === savedPosition.memberId && (current.locationId ?? null) === (savedPosition.locationId ?? null)
  const issues = schedule.data ? getCalendarPreviewIssues(current, {
    rules: schedule.data, timeZone: calendar.timeZone, defaultStartMinute: calendar.startMinute, defaultEndMinute: calendar.endMinute, now: calendar.now,
  }) : isSavedPosition ? savedIssues : undefined
  return <CalendarBookingIssues issues={issues} />
}
