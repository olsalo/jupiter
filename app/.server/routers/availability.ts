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

export const availabilityRouter = {
  calendarSchedule: permissionProcedure({ appointments: ["read"] }).input(rangeInput).query(async ({ ctx, input }) => {
    const rules = await ctx.prisma.availabilityRule.findMany({
      where: {
        organizationId: ctx.organizationId, isBreak: false, locationId: null,
        OR: [{ staffMemberId: null }, { staffMember: { isActive: true, acceptsAppointments: true } }],
      },
      select: { staffMemberId: true, dayOfWeek: true, startMinute: true, endMinute: true, timezone: true, validFrom: true, validUntil: true, isActive: true },
    })
    return rules.map((rule) => ({
      staffMemberId: rule.staffMemberId,
      windows: rule.isActive ? localWindows(input.from, input.to, rule.timezone, rule.dayOfWeek, rule.startMinute, rule.endMinute)
        .map((window) => ({ start: Math.max(window.start, +input.from, rule.validFrom ? +rule.validFrom : -Infinity), end: Math.min(window.end, +input.to, rule.validUntil ? +rule.validUntil : Infinity) }))
        .filter((window) => window.end > window.start) : [],
    }))
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
  getBookingTimes: organizationProcedure.input(calendarBookingTimesInput).query(({ ctx, input }) => getAvailableSlots(ctx.prisma, ctx.organizationId, input, { durationMinutes: input.durationMinutes, listStarts: true })),
  getSlots: organizationProcedure.input(calendarSlotInput).query(({ ctx, input }) => getAvailableSlots(ctx.prisma, ctx.organizationId, input, { durationMinutes: input.durationMinutes })),
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
