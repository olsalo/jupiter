import { createResourceLimits } from "../resource-limits/service"
import type { TRPCRouterRecord } from "@trpc/server"
import { permissionProcedure, organizationProcedure } from "../trpc"
import { assignmentInput, idInput, staffInput, staffUpdateInput, staffCreateInput } from "~/lib/schemas/appointments"
import { notFound, schedulingLock, type Database } from "../services/scheduling"

async function checkAssignments(tx: Database, organizationId: string, memberId?: string | null, serviceIds: string[] = [], locationIds: string[] = []) {
  if (memberId && !await tx.member.findFirst({ where: { id: memberId, organizationId } })) notFound()
  if (await tx.service.count({ where: { organizationId, deletedAt: null, id: { in: serviceIds } } }) !== serviceIds.length) notFound()
  if (await tx.location.count({ where: { organizationId, id: { in: locationIds } } }) !== locationIds.length) notFound()
}
export const staffRouter = {
  list: organizationProcedure.query(({ ctx }) => ctx.prisma.staffMember.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { name: "asc" } })),
  get: organizationProcedure.input(idInput).query(async ({ ctx, input }) => {
    const staff = await ctx.prisma.staffMember.findFirst({ where: { id: input.id, organizationId: ctx.organizationId }, include: { staffServices: { where: { service: { deletedAt: null } } }, staffLocations: true } })
    if (!staff) notFound()
    return staff
  }),
  create: permissionProcedure({ team: ["manage"] }).input(staffCreateInput).mutation(({ ctx, input: { serviceIds, locationIds, ...data } }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    await checkAssignments(tx, ctx.organizationId, data.memberId, serviceIds, locationIds)
    if (!data.memberId) await createResourceLimits(tx).assert(ctx.organizationId, "teamMembers")
    return tx.staffMember.create({ data: { ...data, organizationId: ctx.organizationId, staffServices: { create: serviceIds.map((serviceId) => ({ serviceId })) }, staffLocations: { create: locationIds.map((locationId) => ({ locationId })) } } })
  })),
  update: permissionProcedure({ team: ["manage"] }).input(staffUpdateInput).mutation(({ ctx, input: { id, ...data } }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    if (!await tx.staffMember.findFirst({ where: { id, organizationId: ctx.organizationId } })) notFound()
    await checkAssignments(tx, ctx.organizationId, data.memberId)
    return tx.staffMember.update({ where: { id, organizationId: ctx.organizationId }, data })
  })),
  setServices: permissionProcedure({ team: ["manage"] }).input(assignmentInput).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    if (!await tx.staffMember.findFirst({ where: { id: input.id, organizationId: ctx.organizationId } })) notFound()
    await checkAssignments(tx, ctx.organizationId, undefined, input.ids)
    await tx.staffService.deleteMany({ where: { staffMemberId: input.id, staffMember: { organizationId: ctx.organizationId }, service: { deletedAt: null } } })
    await tx.staffService.createMany({ data: input.ids.map((serviceId) => ({ staffMemberId: input.id, serviceId })) })
    return { id: input.id }
  })),
  setLocations: permissionProcedure({ team: ["manage"] }).input(assignmentInput).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    if (!await tx.staffMember.findFirst({ where: { id: input.id, organizationId: ctx.organizationId } })) notFound()
    await checkAssignments(tx, ctx.organizationId, undefined, [], input.ids)
    await tx.staffLocation.deleteMany({ where: { staffMemberId: input.id, staffMember: { organizationId: ctx.organizationId } } })
    await tx.staffLocation.createMany({ data: input.ids.map((locationId) => ({ staffMemberId: input.id, locationId })) })
    return { id: input.id }
  })),
  archive: permissionProcedure({ team: ["manage"] }).input(idInput).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    if (!await tx.staffMember.findFirst({ where: { id: input.id, organizationId: ctx.organizationId } })) notFound()
    return tx.staffMember.update({ where: { id: input.id, organizationId: ctx.organizationId }, data: { isActive: false, acceptsAppointments: false } })
  })),
} satisfies TRPCRouterRecord
