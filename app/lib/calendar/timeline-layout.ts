import { getCalendarBookingConflicts, layoutCalendarAppointments } from "./appointments.ts"
import { calendarDateToValue } from "./date.ts"
import type { CalendarAppointment, CalendarMember, CalendarUnavailableDay, CalendarUnavailableTime } from "./types.ts"

export const calendarTimelineHourHeight = 128
export const calendarTimelinePadding = 8

type MinuteRange = { startMinute: number; endMinute: number }

export type CalendarTimelineLaneData = {
  day: Date
  date: string
  member: CalendarMember
  appointments: CalendarAppointment[]
  blocked: MinuteRange[]
  unavailableTimes: (MinuteRange & { isBlocked?: boolean; title?: string })[]
  breaks: MinuteRange[]
}

export function getCalendarTimelineLayout({ days, members, appointments, conflictAppointments, unavailableDays, unavailableTimes, breaks = [], startMinute, endMinute, allowSimultaneousBookings, excludeDraftConflicts }: {
  days: Date[]
  members: CalendarMember[]
  appointments: CalendarAppointment[]
  conflictAppointments: CalendarAppointment[]
  unavailableDays: CalendarUnavailableDay[]
  unavailableTimes: CalendarUnavailableTime[]
  breaks?: CalendarUnavailableTime[]
  startMinute: number
  endMinute: number
  allowSimultaneousBookings: boolean
  excludeDraftConflicts: boolean
}) {
  const lanes = new Map<string, CalendarTimelineLaneData>()
  const laneKey = (date: string, memberId: string) => `${date}/${memberId}`
  const layout = days.map((day) => {
    const date = calendarDateToValue(day)
    return { day, date, lanes: members.map((member) => {
      const lane: CalendarTimelineLaneData = { day, date, member, appointments: [], blocked: [], unavailableTimes: [], breaks: [] }
      lanes.set(laneKey(date, member.id), lane)
      return lane
    }) }
  })

  for (const appointment of appointments) lanes.get(laneKey(appointment.day, appointment.memberId))?.appointments.push(appointment)
  for (const unavailable of [...unavailableDays.map((day) => ({ ...day, startMinute, endMinute })), ...unavailableTimes]) {
    const lane = lanes.get(laneKey(unavailable.day, unavailable.memberId))
    if (!lane) continue
    lane.blocked.push(unavailable)
    if (unavailable.endMinute > startMinute && unavailable.startMinute < endMinute) lane.unavailableTimes.push(unavailable)
  }
  for (const period of breaks) {
    const lane = lanes.get(laneKey(period.day, period.memberId))
    if (!lane) continue
    if (period.endMinute > startMinute && period.startMinute < endMinute) lane.breaks.push(period)
  }
  for (const appointment of getCalendarBookingConflicts(conflictAppointments, allowSimultaneousBookings)) {
    if (excludeDraftConflicts && appointment.draft) continue
    lanes.get(laneKey(appointment.day, appointment.memberId))?.blocked.push(appointment.bufferBeforeMinutes || appointment.bufferAfterMinutes ? { ...appointment, startMinute: appointment.startMinute - (appointment.bufferBeforeMinutes ?? 0), endMinute: appointment.endMinute + (appointment.bufferAfterMinutes ?? 0) } : appointment)
  }
  for (const lane of lanes.values()) lane.appointments = layoutCalendarAppointments(lane.appointments)
  return layout
}
