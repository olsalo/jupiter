import { getBookingAvailabilityIssues, type BookingAvailabilityIssue } from "~/lib/calendar/booking-issues"
import { localWindows } from "./time"
import type { Database } from "./scheduling"

type Booking = {
  startsAt: Date
  endsAt: Date
  status: string
  staffMember: { id: string } | null
  location: { id: string } | null
}

// Fetch rules once for the whole list, keeping calendar markers and booking details consistent
export async function withAppointmentAvailabilityIssues<Appointment extends Booking>(db: Database, organizationId: string, appointments: Appointment[], now = Date.now()): Promise<(Appointment & { availabilityIssues?: BookingAvailabilityIssue[] })[]> {
  const future = appointments.filter((appointment) => +appointment.startsAt > now && appointment.staffMember && ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"].includes(appointment.status))
  if (!future.length) return appointments.map((appointment) => ({ ...appointment, availabilityIssues: [] }))
  const from = new Date(Math.min(...future.map((appointment) => +appointment.startsAt)))
  const to = new Date(Math.max(...future.map((appointment) => +appointment.endsAt)))
  const [rules, settings, extraAvailability] = await Promise.all([
    db.availabilityRule.findMany({ where: { organizationId, OR: [{ staffMemberId: null }, { staffMemberId: { in: [...new Set(future.flatMap((appointment) => appointment.staffMember ? [appointment.staffMember.id] : []))] } }] } }),
    db.organizationSettings.findUnique({ where: { organizationId } }),
    db.availabilityOverride.findMany({ where: { organizationId, isAvailable: true, startsAt: { lt: to }, endsAt: { gt: from } } }),
  ])
  const windows = new Map(rules.map((rule) => [rule.id, rule.isActive ? localWindows(from, to, rule.timezone, rule.dayOfWeek, rule.startMinute, rule.endMinute)
    .map((window) => ({ start: Math.max(window.start, rule.validFrom ? +rule.validFrom : -Infinity), end: Math.min(window.end, rule.validUntil ? +rule.validUntil : Infinity) }))
    .filter((window) => window.end > window.start) : []]))
  const defaultWindows = [1, 2, 3, 4, 5].flatMap((day) => localWindows(from, to, settings?.timezone ?? "Europe/Helsinki", day, (settings?.defaultStartHour ?? 8) * 60, (settings?.defaultEndHour ?? 18) * 60))
  const relevant = new Set(future)
  return appointments.map((appointment) => {
    if (!relevant.has(appointment)) return { ...appointment, availabilityIssues: [] }
    const applies = (rule: { staffMemberId: string | null; locationId: string | null }) => (!rule.staffMemberId || rule.staffMemberId === appointment.staffMember?.id) && (!rule.locationId || rule.locationId === appointment.location?.id)
    const working = rules.filter((rule) => !rule.isBreak && applies(rule))
    const own = working.filter((rule) => rule.staffMemberId === appointment.staffMember?.id)
    const effective = own.length ? own : working.filter((rule) => rule.staffMemberId === null)
    return { ...appointment, availabilityIssues: getBookingAvailabilityIssues({
      ...appointment, now,
      workingWindows: [
        ...(effective.length ? effective.flatMap((rule) => windows.get(rule.id) ?? []) : defaultWindows),
        ...extraAvailability.filter(applies).map((override) => ({ start: +override.startsAt, end: +override.endsAt })),
      ],
      breakWindows: rules.filter((rule) => rule.isBreak && applies(rule)).flatMap((rule) => windows.get(rule.id) ?? []),
    }) }
  })
}
