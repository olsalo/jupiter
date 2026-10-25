import { businessHolidayWindows } from "~/lib/business/business-holidays"
import { blockingAppointmentStatuses } from "~/lib/booking/appointment-status"
import { calendarIntervalMinutes } from "~/lib/calendar/time-step"
import { TRPCError } from "@trpc/server"
import type { z } from "~/lib/validation/zod"
import type { slotInput } from "~/lib/schemas/appointments"
import { localDate, localWindows, minuteMs } from "./time"
import { notFound, type Database } from "./scheduling"
import { getBlockedTimeInRange } from "./team-time-off"

export type Slot = { startsAt: string; endsAt: string; staffMemberId: string; locationId: string | null; overlapsBreak?: boolean }
type Interval = { start: number; end: number }
export const blockingStatuses = blockingAppointmentStatuses
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
export function generateSlots({ windows, conflicts, breakConflicts = [], allowBreakOverlapStart, from, to, now, duration, before, after, interval, notice, horizon, exactStart, alignToInterval = false, allowPast = false }: {
  windows: Interval[]; conflicts: Interval[]; breakConflicts?: Interval[]; allowBreakOverlapStart?: number; from: number; to: number; now: number; duration: number; before: number; after: number; interval: number; notice: number; horizon: number | null; exactStart?: number; alignToInterval?: boolean; allowPast?: boolean
}) {
  const starts = new Set<number>()
  for (const window of mergeWindows(windows)) {
    // Preserve the working-window grid even when a buffer requires a later start
    const firstStart = alignToInterval ? Math.ceil(window.start / (interval * minuteMs)) * interval * minuteMs : window.start
    const candidates = new Set<number>()
    if (exactStart !== undefined) candidates.add(exactStart)
    else {
      if (allowBreakOverlapStart !== undefined) candidates.add(allowBreakOverlapStart)
      for (let start = firstStart; start + (duration + after) * minuteMs <= window.end; start += interval * minuteMs) candidates.add(start)
      // Offer starts that touch occupied time even when those edges are off the grid
      for (const conflict of [...conflicts, ...breakConflicts]) {
        candidates.add(conflict.end + before * minuteMs)
        candidates.add(conflict.start - (duration + after) * minuteMs)
      }
    }
    for (const start of candidates) {
      const occupied = { start: start - before * minuteMs, end: start + (duration + after) * minuteMs }
      if (occupied.start < window.start || occupied.end > window.end || start < from || start >= to || (!(allowPast && start < now) && start < now + notice * minuteMs) || (horizon !== null && start > now + horizon * 86400000)) continue
      const breakOverlap = breakConflicts.some((conflict) => overlaps(occupied, conflict))
      if (!conflicts.some((conflict) => overlaps(occupied, conflict)) && (!breakOverlap || start === allowBreakOverlapStart)) starts.add(start)
      if (exactStart !== undefined) break
    }
  }
  return [...starts].sort((a, b) => a - b)
}

export async function getAvailableSlots(db: Database, organizationId: string, input: Omit<z.infer<typeof slotInput>, "serviceId"> & { serviceId?: string }, options: { bookingPolicy?: { minBookingNoticeMinutes: number; maxBookingAdvanceDays: number | null }; preferAdjacentStarts?: boolean; allowPast?: boolean; allowBreakOverlapStart?: number; listStarts?: boolean; durationMinutes?: number; purpose?: "new-booking" | "reschedule"; replacingService?: boolean; useOrganizationDefaults?: boolean; excludeAppointmentId?: string; now?: Date; allowedStaffIds?: string[]; snapshot?: { durationMinutes: number; bufferBeforeMinutes: number; bufferAfterMinutes: number } } = {}) {
  const now = options.now ?? new Date()
  const rescheduling = options.purpose === "reschedule"
  if (!input.serviceId && (!options.listStarts || !options.durationMinutes || rescheduling)) throw new TRPCError({ code: "BAD_REQUEST" })
  if (rescheduling && (!options.excludeAppointmentId || (!options.snapshot && !options.replacingService) || !await db.appointmentService.findFirst({ where: { appointmentId: options.excludeAppointmentId, ...(!options.replacingService ? { serviceId: input.serviceId } : {}), appointment: { organizationId } } }))) notFound()
  const settings = await db.organizationSettings.findUnique({ where: { organizationId } })
  const service = input.serviceId ? await db.service.findFirst({ where: { id: input.serviceId, organizationId, ...(rescheduling && !options.replacingService ? {} : { deletedAt: null, isActive: true }) }, include: { serviceLocations: { where: { isActive: true }, include: { location: true } } } }) : null
  if (input.serviceId && !service) notFound()
  if (service && (service.maxAttendees !== 1 || service.paymentRequirement !== "NONE" || await db.serviceResource.count({ where: { serviceId: service.id } }))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This service needs booking features that are not enabled yet" })
  }
  const remoteWithoutLocation = service && ["ONLINE", "PHONE"].includes(service.deliveryType) && service.serviceLocations.length === 0
  const locationId = input.locationId ?? (options.useOrganizationDefaults === false || !service || remoteWithoutLocation ? undefined : settings?.defaultLocationId ?? undefined)
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
  const rules = await db.availabilityRule.findMany({ where: { organizationId } })
  const overrides = await db.availabilityOverride.findMany({ where: { organizationId, startsAt: { lt: conflictTo }, endsAt: { gt: conflictFrom } } })
  const blocked = await getBlockedTimeInRange(db, organizationId, { from: conflictFrom, to: conflictTo })
  const appointments = settings?.allowSimultaneousBookings === true ? [] : await db.appointment.findMany({ where: { organizationId, ...(options.excludeAppointmentId ? { id: { not: options.excludeAppointmentId } } : {}), status: { in: [...blockingStatuses] },
      startsAt: { lt: conflictTo }, endsAt: { gt: conflictFrom },
      OR: [{ status: { not: "PENDING" } }, { expiresAt: null }, { expiresAt: { gt: now } }],
    }, include: { services: true } })
  const holidays = businessHolidayWindows(settings?.businessHolidays, conflictFrom, conflictTo, settings?.timezone ?? "Europe/Helsinki")
  const slots: Slot[] = []
  const preferredStarts = new Set<string>()
  const slotKey = (slot: Slot) => `${slot.startsAt}/${slot.staffMemberId}/${slot.locationId ?? ""}`
  for (const person of staff) {
    const locations = eligibleLocations.filter((link) => (!locationId || link.locationId === locationId) && person.staffLocations.some((assignment) => assignment.locationId === link.locationId && assignment.location.isActive && assignment.location.organizationId === organizationId)).map((link) => link.location)
    const candidates = service?.serviceLocations.length ? locations : !locationId ? [null] : []
    for (const location of candidates) {
      const applies = (scope: { staffMemberId: string | null; locationId: string | null }) => (!scope.staffMemberId || scope.staffMemberId === person.id) && (!scope.locationId || scope.locationId === location?.id)
      // A member's own schedule replaces business hours, including disabled days
      const workingRules = rules.filter((rule) => !rule.isBreak && applies(rule))
      const ownRules = workingRules.filter((rule) => rule.staffMemberId === person.id)
      const effectiveRules = ownRules.length ? ownRules : workingRules.filter((rule) => rule.staffMemberId === null)
      const windows = effectiveRules.filter((rule) => rule.isActive).flatMap((rule) => localWindows(input.from, input.to, rule.timezone, rule.dayOfWeek, rule.startMinute, rule.endMinute).map((window) => ({ start: Math.max(window.start, rule.validFrom ? +rule.validFrom : -Infinity), end: Math.min(window.end, rule.validUntil ? +rule.validUntil : Infinity) })).filter((window) => window.end > window.start))
      const relevantOverrides = overrides.filter(applies)
      windows.push(...relevantOverrides.filter((override) => override.isAvailable).map((override) => ({ start: +override.startsAt, end: +override.endsAt })))
      windows.push(...holidays.filter((holiday) => holiday.isOpen))
      const breakConflicts = rules.filter((rule) => rule.isActive && rule.isBreak && applies(rule)).flatMap((rule) => localWindows(conflictFrom, conflictTo, rule.timezone, rule.dayOfWeek, rule.startMinute, rule.endMinute).map((window) => ({ start: Math.max(window.start, rule.validFrom ? +rule.validFrom : -Infinity), end: Math.min(window.end, rule.validUntil ? +rule.validUntil : Infinity) })).filter((window) => window.end > window.start))
      const conflicts = [
        ...holidays.filter((holiday) => !holiday.isOpen),
        ...blocked.filter(applies).map((block) => ({ start: +block.startsAt, end: +block.endsAt })),
        ...relevantOverrides.filter((override) => !override.isAvailable).map((override) => ({ start: +override.startsAt, end: +override.endsAt })),
        ...appointments.filter((appointment) => appointment.staffMemberId === person.id).map((appointment) => ({ start: +appointment.startsAt - Math.max(0, ...appointment.services.map((snapshot) => snapshot.bufferBeforeMinutes)) * minuteMs, end: +appointment.endsAt + Math.max(0, ...appointment.services.map((snapshot) => snapshot.bufferAfterMinutes)) * minuteMs })),
      ]
      const snapshot = options.snapshot ?? service ?? { durationMinutes: options.durationMinutes ?? 0, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 }
      const starts = generateSlots({ windows, conflicts, breakConflicts, allowBreakOverlapStart: options.allowBreakOverlapStart, from: +input.from, to: +input.to, now: +now, allowPast: options.allowPast, duration: options.durationMinutes ?? snapshot.durationMinutes, exactStart: options.durationMinutes === undefined || options.listStarts ? undefined : +input.from, alignToInterval: options.listStarts, before: snapshot.bufferBeforeMinutes, after: snapshot.bufferAfterMinutes, interval: options.listStarts ? calendarIntervalMinutes : settings?.defaultSlotIntervalMinutes ?? 15,
        notice: options.bookingPolicy?.minBookingNoticeMinutes ?? service?.minBookingNoticeMinutes ?? settings?.minBookingNoticeMinutes ?? 0,
        horizon: options.bookingPolicy ? options.bookingPolicy.maxBookingAdvanceDays : service?.maxBookingAdvanceDays ?? settings?.maxBookingAdvanceDays ?? null,
      })
      slots.push(...starts.map((start) => {
        const end = start + (options.durationMinutes ?? snapshot.durationMinutes) * minuteMs
        const overlapsBreak = start === options.allowBreakOverlapStart && breakConflicts.some((conflict) => overlaps({ start, end }, conflict))
        const slot = { startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), staffMemberId: person.id, locationId: location?.id ?? null, ...(overlapsBreak ? { overlapsBreak: true } : {}) }
        if ([...conflicts, ...breakConflicts].some((conflict) => conflict.end === start - snapshot.bufferBeforeMinutes * minuteMs || conflict.start === end + snapshot.bufferAfterMinutes * minuteMs)) preferredStarts.add(slotKey(slot))
        return slot
      }))
    }
  }
  const days = new Map<string, Slot[]>()
  for (const slot of slots.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.staffMemberId.localeCompare(b.staffMemberId))) {
    const date = localDate(new Date(slot.startsAt), settings?.bookingTimezone ?? settings?.timezone ?? "Europe/Helsinki")
    days.set(date, [...(days.get(date) ?? []), slot])
  }
  return { days: [...days].map(([date, slots]) => ({ date, slots: options.preferAdjacentStarts
    ? slots.sort((a, b) => Number(preferredStarts.has(slotKey(b))) - Number(preferredStarts.has(slotKey(a))) || a.startsAt.localeCompare(b.startsAt) || a.staffMemberId.localeCompare(b.staffMemberId))
    : slots })) }
}
