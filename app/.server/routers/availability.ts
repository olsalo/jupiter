import { canAccessAvailability, hasOrganizationPermission } from "~/lib/auth/permissions"
import type { TRPCRouterRecord } from "@trpc/server"
import { TRPCError } from "@trpc/server"
import { organizationProcedure, permissionProcedure } from "../trpc"
import { calendarBookingTimesInput, calendarSlotInput, blockedInput, idInput, overrideInput, rangeInput, replaceRulesInput, scopeInput } from "~/lib/schemas/appointments"
import { assertScope, notFound, schedulingLock } from "../services/scheduling"
import { timeOffSchema } from "~/lib/team-time-off"
import { addStaffTimeOff, getBlockedTimeInRange } from "../services/team-time-off"
import { z } from "~/lib/zod"
import { getAvailableSlots } from "../services/availability"
import { localWindows } from "../services/time"
import { Temporal } from "@js-temporal/polyfill"
import { deleteCalendarAvailabilityInput, saveCalendarAvailabilityInput } from "~/lib/schemas/calendar-availability"
import { removeScheduleAt } from "~/lib/calendar/availability"
import { saveStaffSchedule } from "../services/staff-schedule"

export const availabilityRouter = {
  deleteScheduledChange: organizationProcedure.input(deleteCalendarAvailabilityInput).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    assertAvailabilityAccess(ctx.member, input.staffMemberId)
    await assertScope(tx, ctx.organizationId, input)
    const settings = await tx.organizationSettings.findUnique({ where: { organizationId: ctx.organizationId } })
    const timezone = settings?.timezone ?? "Europe/Helsinki"
    const date = Temporal.PlainDate.from(input.effectiveFrom)
    if (Temporal.PlainDate.compare(date, Temporal.Now.plainDateISO(timezone)) <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Only upcoming changes can be deleted" })
    const at = new Date(date.toZonedDateTime(timezone).epochMilliseconds)
    const where = { organizationId: ctx.organizationId, staffMemberId: input.staffMemberId, locationId: null, ...(input.kind ? { isBreak: input.kind === "breaks" } : {}) }
    const existing = await tx.availabilityRule.findMany({ where })
    if (!existing.some((rule) => rule.validFrom && +rule.validFrom === +at)) notFound()
    for (const isBreak of [false, true]) {
      const rules = existing.filter((rule) => rule.isBreak === isBreak)
      if (!rules.some((rule) => rule.validFrom && +rule.validFrom === +at)) continue
      const remaining = removeScheduleAt(rules, at)
      await tx.availabilityRule.deleteMany({ where: { ...where, isBreak } })
      if (remaining.length) await tx.availabilityRule.createMany({ data: remaining.map(({ dayOfWeek, startMinute, endMinute, timezone, isActive, validFrom, validUntil }) => ({ ...where, isBreak, dayOfWeek, startMinute, endMinute, timezone, isActive, validFrom: validFrom ?? null, validUntil: validUntil ?? null })) })
    }
    return { effectiveFrom: input.effectiveFrom }
  })),
  saveSchedule: organizationProcedure.input(saveCalendarAvailabilityInput).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    assertAvailabilityAccess(ctx.member, input.staffMemberId)
    await assertScope(tx, ctx.organizationId, input)
    const settings = await tx.organizationSettings.findUnique({ where: { organizationId: ctx.organizationId } })
    const timezone = settings?.timezone ?? "Europe/Helsinki"
    const date = Temporal.PlainDate.from(input.effectiveFrom)
    if (Temporal.PlainDate.compare(date, Temporal.Now.plainDateISO(timezone)) < 0) {
      throw new TRPCError({ code: "BAD_REQUEST", cause: new z.ZodError([{ code: "custom", path: ["effectiveFrom"], message: "Choose today or a future date" }]) })
    }
    const at = new Date(date.toZonedDateTime(timezone).epochMilliseconds)
    const previousDate = input.previousEffectiveFrom ? Temporal.PlainDate.from(input.previousEffectiveFrom) : null
    if (previousDate && Temporal.PlainDate.compare(previousDate, Temporal.Now.plainDateISO(timezone)) <= 0) {
      throw new TRPCError({ code: "BAD_REQUEST" })
    }
    const previousAt = previousDate ? new Date(previousDate.toZonedDateTime(timezone).epochMilliseconds) : null
    for (const kind of ["workingHours", "breaks"] as const) {
      if (input.kind && input.kind !== kind) continue
      await saveStaffSchedule(tx, { organizationId: ctx.organizationId, staffMemberId: input.staffMemberId, kind, replacement: input[kind], at, timezone, previousAt })
    }
    return { effectiveFrom: input.effectiveFrom }
  })),
  calendarSchedule: permissionProcedure({ appointments: ["read"] }).input(rangeInput).query(async ({ ctx, input }) => {
    const rules = await ctx.prisma.availabilityRule.findMany({
      where: {
        organizationId: ctx.organizationId,
        OR: [{ staffMemberId: null }, { staffMember: { isActive: true, acceptsAppointments: true } }],
      },
      select: { staffMemberId: true, locationId: true, isBreak: true, dayOfWeek: true, startMinute: true, endMinute: true, timezone: true, validFrom: true, validUntil: true, isActive: true },
    })
    const extraAvailability = await ctx.prisma.availabilityOverride.findMany({ where: { organizationId: ctx.organizationId, isAvailable: true, startsAt: { lt: input.to }, endsAt: { gt: input.from } } })
    const blocked = await getBlockedTimeInRange(ctx.prisma, ctx.organizationId, input)
    return [...rules.map((rule) => ({
      locationId: rule.locationId,
      staffMemberId: rule.staffMemberId,
      isBreak: rule.isBreak,
      windows: rule.isActive ? localWindows(input.from, input.to, rule.timezone, rule.dayOfWeek, rule.startMinute, rule.endMinute)
        .map((window) => ({ start: Math.max(window.start, +input.from, rule.validFrom ? +rule.validFrom : -Infinity), end: Math.min(window.end, +input.to, rule.validUntil ? +rule.validUntil : Infinity) }))
        .filter((window) => window.end > window.start) : [],
    })), ...extraAvailability.map((override) => ({
      staffMemberId: override.staffMemberId, locationId: override.locationId, isBreak: false, isExtra: true,
      windows: [{ start: Math.max(+override.startsAt, +input.from), end: Math.min(+override.endsAt, +input.to) }],
    })), ...blocked.map((entry) => ({
      staffMemberId: entry.staffMemberId, locationId: entry.locationId, isBreak: false, isBlocked: true, title: entry.title ?? undefined,
      windows: [{ start: Math.max(+entry.startsAt, +input.from), end: Math.min(+entry.endsAt, +input.to) }],
    }))]
  }),
  getTimeOff: organizationProcedure.input(z.object({ staffMemberId: scopeInput.shape.staffMemberId.unwrap() })).query(async ({ ctx, input }) => {
    assertAvailabilityAccess(ctx.member, input.staffMemberId, true)
    await assertScope(ctx.prisma, ctx.organizationId, input)
    return ctx.prisma.blockedTime.findMany({ where: { organizationId: ctx.organizationId, staffMemberId: input.staffMemberId, locationId: null }, orderBy: { startsAt: "asc" } })
  }),
  addTimeOff: organizationProcedure.input(timeOffSchema().safeExtend({ staffMemberId: scopeInput.shape.staffMemberId.unwrap() })).mutation(({ ctx, input }) => {
    assertAvailabilityAccess(ctx.member, input.staffMemberId)
    return addStaffTimeOff(ctx.prisma, ctx.organizationId, input.staffMemberId, input)
  }),
  getRules: organizationProcedure.input(scopeInput).query(async ({ ctx, input }) => {
    assertAvailabilityAccess(ctx.member, input.staffMemberId, true)
    await assertScope(ctx.prisma, ctx.organizationId, input)
    return ctx.prisma.availabilityRule.findMany({ where: { organizationId: ctx.organizationId, isBreak: false, staffMemberId: input.staffMemberId ?? null, locationId: input.locationId }, orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] })
  }),
  getBreaks: organizationProcedure.input(scopeInput).query(async ({ ctx, input }) => {
    assertAvailabilityAccess(ctx.member, input.staffMemberId, true)
    await assertScope(ctx.prisma, ctx.organizationId, input)
    return ctx.prisma.availabilityRule.findMany({ where: { organizationId: ctx.organizationId, isBreak: true, staffMemberId: input.staffMemberId ?? null, locationId: input.locationId }, orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] })
  }),
  replaceRules: organizationProcedure.input(replaceRulesInput).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    assertAvailabilityAccess(ctx.member, input.staffMemberId)
    await assertScope(tx, ctx.organizationId, input)
    const where = { organizationId: ctx.organizationId, isBreak: false, staffMemberId: input.staffMemberId ?? null, locationId: input.locationId ?? null }
    await tx.availabilityRule.deleteMany({ where })
    await tx.availabilityRule.createMany({ data: input.rules.map((rule) => ({ ...where, ...rule })) })
    return tx.availabilityRule.findMany({ where, orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] })
  })),
  getExtraHours: organizationProcedure.input(z.object({ staffMemberId: scopeInput.shape.staffMemberId.unwrap() })).query(async ({ ctx, input }) => {
    assertAvailabilityAccess(ctx.member, input.staffMemberId)
    await assertScope(ctx.prisma, ctx.organizationId, input)
    return ctx.prisma.availabilityOverride.findMany({ where: { organizationId: ctx.organizationId, staffMemberId: input.staffMemberId, locationId: null, isAvailable: true, endsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" } })
  }),
  listOverrides: organizationProcedure.input(rangeInput.safeExtend(scopeInput.shape)).query(({ ctx, input }) => {
    assertAvailabilityAccess(ctx.member, input.staffMemberId)
    return ctx.prisma.availabilityOverride.findMany({ where: { organizationId: ctx.organizationId, staffMemberId: input.staffMemberId ?? null, locationId: input.locationId, startsAt: { lt: input.to }, endsAt: { gt: input.from } }, orderBy: { startsAt: "asc" } })
  }),
  createOverride: organizationProcedure.input(overrideInput).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    assertAvailabilityAccess(ctx.member, input.staffMemberId)
    await assertScope(tx, ctx.organizationId, input)
    const conflicting = await tx.availabilityOverride.findFirst({ where: { organizationId: ctx.organizationId, isAvailable: !input.isAvailable,
      startsAt: { lt: input.endsAt }, endsAt: { gt: input.startsAt },
      AND: [{ OR: input.staffMemberId ? [{ staffMemberId: null }, { staffMemberId: input.staffMemberId }] : [{}] }, { OR: input.locationId ? [{ locationId: null }, { locationId: input.locationId }] : [{}] }],
    } })
    if (conflicting) throw new TRPCError({ code: "CONFLICT", message: "This overlaps another availability change" })
    return tx.availabilityOverride.create({ data: { organizationId: ctx.organizationId, ...input } })
  })),
  deleteOverride: organizationProcedure.input(idInput).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    const target = await tx.availabilityOverride.findFirst({ where: { id: input.id, organizationId: ctx.organizationId } })
    if (!target) notFound()
    assertAvailabilityAccess(ctx.member, target.staffMemberId)
    const result = await tx.availabilityOverride.deleteMany({ where: { id: input.id, organizationId: ctx.organizationId } })
    if (!result.count) notFound()
    return { id: input.id }
  })),
  listBlockedTime: organizationProcedure.input(rangeInput.safeExtend(scopeInput.shape)).query(({ ctx, input }) => {
    assertAvailabilityAccess(ctx.member, input.staffMemberId)
    return getBlockedTimeInRange(ctx.prisma, ctx.organizationId, input, { staffMemberId: input.staffMemberId ?? null, locationId: input.locationId })
  }),
  createBlockedTime: organizationProcedure.input(blockedInput).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    assertAvailabilityAccess(ctx.member, input.staffMemberId)
    await assertScope(tx, ctx.organizationId, input)
    return tx.blockedTime.create({ data: { organizationId: ctx.organizationId, ...input } })
  })),
  deleteBlockedTime: organizationProcedure.input(idInput).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    const target = await tx.blockedTime.findFirst({ where: { id: input.id, organizationId: ctx.organizationId } })
    if (!target) notFound()
    assertAvailabilityAccess(ctx.member, target.staffMemberId)
    const result = await tx.blockedTime.deleteMany({ where: { id: input.id, organizationId: ctx.organizationId } })
    if (!result.count) notFound()
    return { id: input.id }
  })),
  getBookingTimes: organizationProcedure.input(calendarBookingTimesInput).query(({ ctx, input }) => getAvailableSlots(ctx.prisma, ctx.organizationId, input, { allowPast: true, allowBreakOverlapStart: input.selectedStart ? +input.selectedStart : undefined, durationMinutes: input.durationMinutes, listStarts: true })),
  getSlots: organizationProcedure.input(calendarSlotInput).query(({ ctx, input }) => getAvailableSlots(ctx.prisma, ctx.organizationId, input, { allowPast: true, durationMinutes: input.durationMinutes, listStarts: input.durationMinutes !== undefined })),
} satisfies TRPCRouterRecord

function assertAvailabilityAccess(
  member: Parameters<typeof canAccessAvailability>[0],
  staffMemberId: string | null | undefined,
  allowBusinessDefaults = false,
) {
  // Shared business hours are needed to show a person's inherited schedule
  if (allowBusinessDefaults && !staffMemberId && hasOrganizationPermission(member.role, { availability: ["own"] })) return
  if (!canAccessAvailability(member, staffMemberId)) throw new TRPCError({ code: "FORBIDDEN" })
}
