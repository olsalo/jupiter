import { blocksAppointmentTime, canRescheduleAppointment } from "../appointment-status.ts"
import type { BookingAvailabilityIssue } from "./booking-issues.ts"
import type { CalendarAppointment } from "./types.ts"
import { TZDate } from "react-day-picker"

import { calendarDateFromValue, calendarDateToValue } from "./date.ts"

export const unassignedCalendarMemberId = "unassigned"

type Booking = {
  id: string
  availabilityIssues?: BookingAvailabilityIssue[]
  startsAt: Date | string
  endsAt: Date | string
  status: string
  location?: { id: string } | null
  customer: { firstName: string; lastName: string | null }
  staffMember: { id: string; name: string } | null
  services: { bufferBeforeMinutes?: number; bufferAfterMinutes?: number; serviceId: string; name: string; service: { color: string | null } }[]
}

export function getCalendarAppointments(bookings: Booking[], days: Date[], timeZone: string): CalendarAppointment[] {
  const dateRanges = days.map((day) => {
    const value = calendarDateToValue(day)
    const midnight = calendarDateFromValue(value, timeZone)
    const nextMidnight = calendarDateFromValue(value, timeZone)
    nextMidnight.setDate(nextMidnight.getDate() + 1)
    return { value, from: +midnight, to: +nextMidnight }
  })
  return bookings.flatMap((booking) => dateRanges.flatMap(({ value, from, to }) => {
    const start = Math.max(+new Date(booking.startsAt), from)
    const end = Math.min(+new Date(booking.endsAt), to)
    if (end <= start) return []
    const localStart = new TZDate(start, timeZone)
    const localEnd = new TZDate(end, timeZone)
    const service = booking.services[0]
    return [{
      id: booking.id,
      day: value,
      memberId: booking.staffMember?.id ?? unassignedCalendarMemberId,
      locationId: booking.location?.id,
      customerName: [booking.customer.firstName, booking.customer.lastName].filter(Boolean).join(" "),
      startMinute: localStart.getHours() * 60 + localStart.getMinutes(),
      endMinute: end === to ? 1440 : localEnd.getHours() * 60 + localEnd.getMinutes(),
      status: booking.status,
      ...(booking.availabilityIssues ? { availabilityIssues: booking.availabilityIssues } : {}),
      movable: Boolean(booking.staffMember && booking.services.length === 1 && canRescheduleAppointment(booking.status)),
      bufferBeforeMinutes: Math.max(0, ...booking.services.map((service) => service.bufferBeforeMinutes ?? 0)),
      bufferAfterMinutes: Math.max(0, ...booking.services.map((service) => service.bufferAfterMinutes ?? 0)),
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
  return appointments.filter((appointment) => appointment.draft || blocksAppointmentTime(appointment.status ?? ""))
}
