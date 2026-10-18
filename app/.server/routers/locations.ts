import type { TRPCRouterRecord } from "@trpc/server"
import { permissionProcedure, organizationProcedure } from "../trpc"
import { idInput, locationInput, locationUpdateInput } from "~/lib/schemas/appointments"
import { notFound, schedulingLock } from "../services/scheduling"

export const locationRouter = {
  list: organizationProcedure.query(({ ctx }) => ctx.prisma.location.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { name: "asc" } })),
  create: permissionProcedure({ locations: ["configure"] }).input(locationInput).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    return tx.location.create({ data: { ...input, organizationId: ctx.organizationId } })
  })),
  update: permissionProcedure({ locations: ["configure"] }).input(locationUpdateInput).mutation(({ ctx, input: { id, ...data } }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    if (!await tx.location.findFirst({ where: { id, organizationId: ctx.organizationId } })) notFound()
    return tx.location.update({ where: { id, organizationId: ctx.organizationId }, data })
  })),
  archive: permissionProcedure({ locations: ["configure"] }).input(idInput).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    if (!await tx.location.findFirst({ where: { id: input.id, organizationId: ctx.organizationId } })) notFound()
    return tx.location.update({ where: { id: input.id, organizationId: ctx.organizationId }, data: { isActive: false } })
  })),
} satisfies TRPCRouterRecord
