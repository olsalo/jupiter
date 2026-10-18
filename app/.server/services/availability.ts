import { TRPCError } from "@trpc/server"
import type { z } from "~/lib/zod"
import type { slotInput } from "~/lib/schemas/appointments"
import { localDate, localWindows, minuteMs } from "./time"
import { notFound, type Database } from "./scheduling"
import { getBlockedTimeInRange } from "./team-time-off"

export type Slot = { startsAt: string; endsAt: string; staffMemberId: string; locationId: string | null }
type Interval = { start: number; end: number }
export const blockingStatuses = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] as const
export function overlaps(a: Interval, b: Interval) { return a.start < b.end && a.end > b.start }
export function mergeWindows(windows: Interval[]) {
  const merged: Interval[] = []
  for (const window of windows.sort((a, b) => a.start - b.start)) {
    const last = merged.at(-1)
    if (last && window.start <= last.end) last.end = Math.max(last.end, window.end)
    else merged.push({ ...window })
  }
  return merged
}
export function generateSlots({ windows, conflicts, from, to, now, duration, before, after, interval, notice, horizon, exactStart, alignToInterval = false }: {
  windows: Interval[]; conflicts: Interval[]; from: number; to: number; now: number; duration: number; before: number; after: number; interval: number; notice: number; horizon: number | null; exactStart?: number; alignToInterval?: boolean
}) {
  const starts = new Set<number>()
  for (const window of mergeWindows(windows)) {
    // Preserve the working-window grid even when a buffer requires a later start
    const firstStart = alignToInterval ? Math.ceil(window.start / (interval * minuteMs)) * interval * minuteMs : window.start
    for (let start = exactStart ?? firstStart; start + (duration + after) * minuteMs <= window.end && (exactStart === undefined || start === exactStart); start += interval * minuteMs) {
      const occupied = { start: start - before * minuteMs, end: start + (duration + after) * minuteMs }
      if (occupied.start < window.start || start < from || start >= to || start < now + notice * minuteMs || (horizon !== null && start > now + horizon * 86400000)) continue
      if (!conflicts.some((conflict) => overlaps(occupied, conflict))) starts.add(start)
      if (exactStart !== undefined) break
    }
  }
  return [...starts].sort((a, b) => a - b)
}

export async function getAvailableSlots(db: Database, organizationId: string, input: Omit<z.infer<typeof slotInput>, "serviceId"> & { serviceId?: string }, options: { listStarts?: boolean; durationMinutes?: number; purpose?: "new-booking" | "reschedule"; useOrganizationDefaults?: boolean; excludeAppointmentId?: string; now?: Date; allowedStaffIds?: string[]; snapshot?: { durationMinutes: number; bufferBeforeMinutes: number; bufferAfterMinutes: number } } = {}) {
  const now = options.now ?? new Date()
  const rescheduling = options.purpose === "reschedule"
  if (!input.serviceId && (!options.listStarts || !options.durationMinutes || !input.staffMemberId || rescheduling)) throw new TRPCError({ code: "BAD_REQUEST" })
  if (rescheduling && (!options.excludeAppointmentId || !options.snapshot || !await db.appointmentService.findFirst({ where: { appointmentId: options.excludeAppointmentId, serviceId: input.serviceId, appointment: { organizationId } } }))) notFound()
  const settings = await db.organizationSettings.findUnique({ where: { organizationId } })
  const service = input.serviceId ? await db.service.findFirst({ where: { id: input.serviceId, organizationId, ...(rescheduling ? {} : { deletedAt: null, isActive: true }) }, include: { serviceLocations: { where: { isActive: true }, include: { location: true } } } }) : null
  if (input.serviceId && !service) notFound()
  if (service && (service.maxAttendees !== 1 || service.paymentRequirement !== "NONE" || await db.serviceResource.count({ where: { serviceId: service.id } }))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This service needs booking features that are not enabled yet" })
  }
  const locationId = input.locationId ?? (options.useOrganizationDefaults === false || !service ? undefined : settings?.defaultLocationId ?? undefined)
  const staff = await db.staffMember.findMany({
    where: { organizationId, isActive: true, acceptsAppointments: true,
      ...(input.staffMemberId ? { id: input.staffMemberId } : options.allowedStaffIds ? { id: { in: options.allowedStaffIds } } : {}),
      ...(service ? { staffServices: { some: { serviceId: service.id, isActive: true } } } : {}),
    }, include: { staffLocations: { where: { isActive: true }, include: { location: true } } }, take: 51,
  })
  if (staff.length > 50) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a staff member" })
  if (input.staffMemberId && (!staff.length || (options.allowedStaffIds && !options.allowedStaffIds.includes(input.staffMemberId)))) notFound()
  const eligibleLocations = (service?.serviceLocations ?? []).filter((link) => link.location.organizationId === organizationId && link.location.isActive)
  if (locationId && !eligibleLocations.some((link) => link.locationId === locationId)) notFound()
  if (eligibleLocations.length > 20) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a location" })
  // A single-instant booking recheck must load conflicts over the entire
  // possible occupied interval, not merely over the candidate start timestamp
  const conflictFrom = new Date(+input.from - 480 * minuteMs)
  const conflictTo = new Date(+input.to + 1920 * minuteMs)
  // Prisma interactive transactions share a single connection
  const rules = await db.availabilityRule.findMany({ where: { organizationId, isActive: true } })
  const overrides = await db.availabilityOverride.findMany({ where: { organizationId, startsAt: { lt: conflictTo }, endsAt: { gt: conflictFrom } } })
  const blocked = await getBlockedTimeInRange(db, organizationId, { from: conflictFrom, to: conflictTo })
  const appointments = settings?.allowSimultaneousBookings === true ? [] : await db.appointment.findMany({ where: { organizationId, ...(options.excludeAppointmentId ? { id: { not: options.excludeAppointmentId } } : {}), status: { in: [...blockingStatuses] },
      startsAt: { lt: conflictTo }, endsAt: { gt: conflictFrom },
      OR: [{ status: { not: "PENDING" } }, { expiresAt: null }, { expiresAt: { gt: now } }],
    }, include: { services: true } })
  const slots: Slot[] = []
  for (const person of staff) {
    const locations = eligibleLocations.filter((link) => (!locationId || link.locationId === locationId) && person.staffLocations.some((assignment) => assignment.locationId === link.locationId && assignment.location.isActive && assignment.location.organizationId === organizationId)).map((link) => link.location)
    const candidates = service?.serviceLocations.length ? locations : !locationId ? [null] : []
    for (const location of candidates) {
      const applies = (scope: { staffMemberId: string | null; locationId: string | null }) => (!scope.staffMemberId || scope.staffMemberId === person.id) && (!scope.locationId || scope.locationId === location?.id)
      const windows = rules.filter((rule) => !rule.isBreak && applies(rule)).flatMap((rule) => localWindows(input.from, input.to, rule.timezone, rule.dayOfWeek, rule.startMinute, rule.endMinute).map((window) => ({ start: Math.max(window.start, rule.validFrom ? +rule.validFrom : -Infinity), end: Math.min(window.end, rule.validUntil ? +rule.validUntil : Infinity) })).filter((window) => window.end > window.start))
      const relevantOverrides = overrides.filter(applies)
      windows.push(...relevantOverrides.filter((override) => override.isAvailable).map((override) => ({ start: +override.startsAt, end: +override.endsAt })))
      const conflicts = [
        ...rules.filter((rule) => rule.isBreak && applies(rule)).flatMap((rule) => localWindows(conflictFrom, conflictTo, settings?.timezone ?? "Europe/Helsinki", rule.dayOfWeek, rule.startMinute, rule.endMinute).map((window) => ({ start: Math.max(window.start, rule.validFrom ? +rule.validFrom : -Infinity), end: Math.min(window.end, rule.validUntil ? +rule.validUntil : Infinity) })).filter((window) => window.end > window.start)),
        ...blocked.filter(applies).map((block) => ({ start: +block.startsAt, end: +block.endsAt })),
        ...relevantOverrides.filter((override) => !override.isAvailable).map((override) => ({ start: +override.startsAt, end: +override.endsAt })),
        ...appointments.filter((appointment) => appointment.staffMemberId === person.id).map((appointment) => ({ start: +appointment.startsAt - Math.max(0, ...appointment.services.map((snapshot) => snapshot.bufferBeforeMinutes)) * minuteMs, end: +appointment.endsAt + Math.max(0, ...appointment.services.map((snapshot) => snapshot.bufferAfterMinutes)) * minuteMs })),
      ]
      const snapshot = options.snapshot ?? service ?? { durationMinutes: options.durationMinutes ?? 0, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 }
      const starts = generateSlots({ windows, conflicts, from: +input.from, to: +input.to, now: +now, duration: options.durationMinutes ?? snapshot.durationMinutes, exactStart: options.durationMinutes === undefined || options.listStarts ? undefined : +input.from, alignToInterval: options.listStarts, before: snapshot.bufferBeforeMinutes, after: snapshot.bufferAfterMinutes, interval: options.listStarts ? 5 : settings?.defaultSlotIntervalMinutes ?? 15,
        // Existing schema has a non-null service notice default of zero: zero inherits
        notice: service?.minBookingNoticeMinutes || settings?.minBookingNoticeMinutes || 0,
        horizon: service?.maxBookingAdvanceDays ?? settings?.maxBookingAdvanceDays ?? null,
      })
      slots.push(...starts.map((start) => ({ startsAt: new Date(start).toISOString(), endsAt: new Date(start + (options.durationMinutes ?? snapshot.durationMinutes) * minuteMs).toISOString(), staffMemberId: person.id, locationId: location?.id ?? null })))
    }
  }
  const days = new Map<string, Slot[]>()
  for (const slot of slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.staffMemberId.localeCompare(b.staffMemberId))) {
    const date = localDate(new Date(slot.startsAt), settings?.defaultTimezone ?? settings?.timezone ?? "Europe/Helsinki")
    days.set(date, [...(days.get(date) ?? []), slot])
  }
  return { days: [...days].map(([date, slots]) => ({ date, slots })) }
}
