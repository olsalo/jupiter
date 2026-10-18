import { TZDate } from "react-day-picker"

import type { CalendarAppointment } from "~/components/calendar/calendar-appointment"
import { calendarDateFromValue, calendarDateToValue } from "~/lib/calendar-date"

export const unassignedCalendarMemberId = "unassigned"

type Booking = {
  id: string
  startsAt: Date | string
  endsAt: Date | string
  status: string
  customer: { firstName: string; lastName: string | null }
  staffMember: { id: string; name: string } | null
  services: { serviceId: string; name: string; service: { color: string | null } }[]
}

export function getCalendarAppointments(bookings: Booking[], days: Date[], timeZone: string): CalendarAppointment[] {
  return bookings.flatMap((booking) => days.flatMap((day) => {
    const value = calendarDateToValue(day)
    const midnight = calendarDateFromValue(value, timeZone)
    const nextMidnight = calendarDateFromValue(value, timeZone)
    nextMidnight.setDate(nextMidnight.getDate() + 1)
    const start = Math.max(+new Date(booking.startsAt), +midnight)
    const end = Math.min(+new Date(booking.endsAt), +nextMidnight)
    if (end <= start) return []
    const localStart = new TZDate(start, timeZone)
    const localEnd = new TZDate(end, timeZone)
    const service = booking.services[0]
    return [{
      id: booking.id,
      day: value,
      memberId: booking.staffMember?.id ?? unassignedCalendarMemberId,
      customerName: [booking.customer.firstName, booking.customer.lastName].filter(Boolean).join(" "),
      startMinute: localStart.getHours() * 60 + localStart.getMinutes(),
      endMinute: end === +nextMidnight ? 1440 : localEnd.getHours() * 60 + localEnd.getMinutes(),
      status: booking.status,
      movable: Boolean(booking.staffMember && booking.services.length === 1 && ["PENDING", "CONFIRMED"].includes(booking.status)),
      durationMinutes: (+new Date(booking.endsAt) - +new Date(booking.startsAt)) / 60000,
      service: { id: service?.serviceId ?? "", name: booking.services.map((item) => item.name).join(", "), color: service?.service.color ?? "var(--primary)" },
    }]
  }))
}

export function layoutCalendarAppointments(appointments: CalendarAppointment[]) {
  const sorted = [...appointments].sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute || a.id.localeCompare(b.id))
  const result: (CalendarAppointment & { column: number; columns: number })[] = []
  let group: (CalendarAppointment & { column: number })[] = []
  let columnEnds: number[] = []
  let groupEnd = -1
  const flush = () => {
    result.push(...group.map((appointment) => ({ ...appointment, columns: columnEnds.length })))
    group = []
    columnEnds = []
  }
  for (const appointment of sorted) {
    if (appointment.startMinute >= groupEnd) flush()
    let column = columnEnds.findIndex((end) => end <= appointment.startMinute)
    if (column === -1) column = columnEnds.length
    columnEnds[column] = appointment.endMinute
    group.push({ ...appointment, column })
    groupEnd = Math.max(appointment.endMinute, group.length === 1 ? -1 : groupEnd)
  }
  flush()
  return result
}

export function getCalendarBookingConflicts(appointments: CalendarAppointment[], allowSimultaneousBookings: boolean) {
  if (allowSimultaneousBookings) return []
  return appointments.filter((appointment) => appointment.draft || ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"].includes(appointment.status ?? ""))
}
