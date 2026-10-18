import type { TRPCRouterRecord } from "@trpc/server"
import { permissionProcedure } from "../trpc"
import { customerInput, idInput, paginationInput } from "~/lib/schemas/appointments"
import { notFound, schedulingLock } from "../services/scheduling"

export const customerRouter = {
  list: permissionProcedure({ customers: ["read"] }).input(paginationInput).query(async ({ ctx, input }) => {
    const rows = await ctx.prisma.customer.findMany({ where: { organizationId: ctx.organizationId, ...(input.cursor ? { id: { gt: input.cursor } } : {}), ...(input.search ? { OR: ["firstName", "lastName", "email", "phone"].map((field) => ({ [field]: { contains: input.search, mode: "insensitive" } })) } : {}) }, orderBy: { id: "asc" }, take: input.limit + 1, select: { id: true, firstName: true, lastName: true, email: true, phone: true } })
    const hasMore = rows.length > input.limit
    if (hasMore) rows.pop()
    return { items: rows, nextCursor: hasMore ? rows.at(-1)?.id : undefined }
  }),
  get: permissionProcedure({ customers: ["read"] }).input(idInput).query(async ({ ctx, input }) => {
    const customer = await ctx.prisma.customer.findFirst({ where: { id: input.id, organizationId: ctx.organizationId } })
    if (!customer) notFound()
    return customer
  }),
  create: permissionProcedure({ customers: ["create"] }).input(customerInput).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    return tx.customer.create({ data: { ...input, organizationId: ctx.organizationId } })
  })),
  update: permissionProcedure({ customers: ["update"] }).input(idInput.extend(customerInput.partial().shape)).mutation(({ ctx, input: { id, ...data } }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    if (!await tx.customer.findFirst({ where: { id, organizationId: ctx.organizationId } })) notFound()
    return tx.customer.update({ where: { id, organizationId: ctx.organizationId }, data })
  })),
  getAppointments: permissionProcedure({ customers: ["read"] }).input(idInput.extend(paginationInput.shape)).query(async ({ ctx, input }) => {
    if (!await ctx.prisma.customer.findFirst({ where: { id: input.id, organizationId: ctx.organizationId } })) notFound()
    const rows = await ctx.prisma.appointment.findMany({ where: { organizationId: ctx.organizationId, customerId: input.id, ...(input.cursor ? { id: { lt: input.cursor } } : {}) }, take: input.limit + 1, orderBy: { id: "desc" }, select: { id: true, startsAt: true, endsAt: true, status: true, services: { select: { name: true } } } })
    const hasMore = rows.length > input.limit
    if (hasMore) rows.pop()
    return { items: rows, nextCursor: hasMore ? rows.at(-1)?.id : undefined }
  }),
} satisfies TRPCRouterRecord
