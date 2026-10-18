import type { CalendarAppointment } from "~/components/calendar/calendar-appointment"
import type { CalendarMember, CalendarUnavailableDay } from "~/components/calendar/week-calendar"
import { calendarDateToValue } from "~/lib/calendar-date"

export const mockCalendarServices = [
  { id: "consultation", color: "#8f49b5", durationMinutes: 60 },
  { id: "treatment", color: "#30968d", durationMinutes: 90 },
  { id: "followUp", color: "#1d6bc0", durationMinutes: 45 },
  { id: "extendedTreatment", color: "#f97b28", durationMinutes: 120 },
] as const

const customers = ["Emma Korhonen", "Oliver Laine", "Sofia Nieminen", "Leo Virtanen", "Aino Mäkelä", "Elias Salonen", "Ella Koskinen", "Noah Lehtinen", "Isla Heikkilä", "Eino Rantanen", "Helmi Aaltonen", "Onni Mäkinen"]

export function createMockCalendarUnavailableDays(days: Date[], members: CalendarMember[]): CalendarUnavailableDay[] {
  if (members.length === 0) return []
  return [1, 3].flatMap((dayIndex, index) => days[dayIndex] ? [{ day: calendarDateToValue(days[dayIndex]), memberId: members[index % members.length].id }] : [])
}

export function createMockCalendarAppointments({ days, members, startMinute, endMinute, services, unavailableDays = [] }: {
  days: Date[]
  members: CalendarMember[]
  startMinute: number
  endMinute: number
  services: (CalendarAppointment["service"] & { durationMinutes: number })[]
  unavailableDays?: CalendarUnavailableDay[]
}): CalendarAppointment[] {
  if (services.length === 0) return []
  return days.flatMap((day, dayIndex) => members.flatMap((member, memberIndex) => {
    if (unavailableDays.some((unavailable) => unavailable.day === calendarDateToValue(day) && unavailable.memberId === member.id)) return []
    const seed = dayIndex * members.length + memberIndex
    return [30, 210, 405].flatMap((offset, index) => {
      const service = services[(seed + index) % services.length]
      const start = startMinute + offset + (seed % 3) * 15
      const end = Math.min(endMinute, start + service.durationMinutes)
      if (end - start < 30) return []
      return [{
        id: `mock-${calendarDateToValue(day)}-${member.id}-${index}`,
        day: calendarDateToValue(day),
        memberId: member.id,
        customerName: customers[(seed * 3 + index) % customers.length],
        startMinute: start,
        endMinute: end,
        service,
      }]
    })
  }))
}
