import { TZDate } from "react-day-picker"

import { getBookingAvailabilityIssues } from "./booking-issues.ts"
import { calendarDateToValue, getCalendarTimeRange } from "./date.ts"
import type { CalendarScheduleRule } from "./schedule.ts"
import type { CalendarAppointment } from "./types.ts"

type BookingPosition = { startsAt: Date | string; endsAt: Date | string; memberId: string; locationId?: string | null; status: string }

export function getCalendarPreviewIssues(booking: BookingPosition, { rules, timeZone, defaultStartMinute, defaultEndMinute, now }: {
  rules: CalendarScheduleRule[]
  timeZone: string
  defaultStartMinute: number
  defaultEndMinute: number
  now: number
}) {
  if (!booking.memberId || booking.memberId === "unassigned") return []
  const applies = (rule: CalendarScheduleRule) => (!rule.staffMemberId || rule.staffMemberId === booking.memberId) && (!rule.locationId || rule.locationId === booking.locationId)
  const working = rules.filter((rule) => !rule.isBreak && !rule.isExtra && !rule.isBlocked && applies(rule))
  const own = working.filter((rule) => rule.staffMemberId === booking.memberId)
  const effective = own.length ? own : working.filter((rule) => rule.staffMemberId === null)
  const defaults = []
  const day = new TZDate(+new Date(booking.startsAt), timeZone)
  day.setHours(0, 0, 0, 0)
  while (+day < +new Date(booking.endsAt)) {
    if (day.getDay() >= 1 && day.getDay() <= 5) {
      const range = getCalendarTimeRange(calendarDateToValue(day), defaultStartMinute, defaultEndMinute - defaultStartMinute, timeZone)
      defaults.push({ start: +range.startsAt, end: +range.endsAt })
    }
    day.setDate(day.getDate() + 1)
  }
  return getBookingAvailabilityIssues({
    startsAt: new Date(booking.startsAt), endsAt: new Date(booking.endsAt), status: booking.status, now,
    workingWindows: [...(effective.length ? effective.flatMap((rule) => rule.windows) : defaults), ...rules.filter((rule) => rule.isExtra && applies(rule)).flatMap((rule) => rule.windows)],
    breakWindows: rules.filter((rule) => rule.isBreak && applies(rule)).flatMap((rule) => rule.windows),
  })
}

export function getCalendarAppointmentPosition(appointment: CalendarAppointment, timeZone: string) {
  const range = getCalendarTimeRange(appointment.day, appointment.startMinute, appointment.durationMinutes ?? appointment.endMinute - appointment.startMinute, timeZone)
  return { ...range, memberId: appointment.memberId, locationId: appointment.locationId, status: appointment.status ?? "CONFIRMED" }
}
