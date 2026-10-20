import type { TRPCRouterRecord } from "@trpc/server"
import { z } from "~/lib/zod"
import { customerNoteSchema } from "~/lib/schemas/customers"
import { permissionProcedure } from "../trpc"
import { customerInput, idInput, paginationInput } from "~/lib/schemas/appointments"
import { notFound, schedulingLock } from "../services/scheduling"
import { getCustomerAppointments } from "../services/customer-appointments"

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
    const now = new Date()
    const [upcoming, history, recent] = await Promise.all([
      getCustomerAppointments(ctx.prisma, ctx.organizationId, { id: input.id, scope: "upcoming", limit: 20 }, now),
      getCustomerAppointments(ctx.prisma, ctx.organizationId, { id: input.id, scope: "history", limit: 20 }, now),
      getCustomerAppointments(ctx.prisma, ctx.organizationId, { id: input.id, scope: "recent", limit: 1 }, now),
    ])
    return { ...customer, appointments: { upcoming, history, recent } }
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
  getAppointments: permissionProcedure({ customers: ["read"] }).input(idInput.extend(paginationInput.shape).extend({ scope: z.enum(["all", "upcoming", "history", "recent"]).default("all") })).query(async ({ ctx, input }) => {
    if (!await ctx.prisma.customer.findFirst({ where: { id: input.id, organizationId: ctx.organizationId } })) notFound()
    if (input.cursor && !await ctx.prisma.appointment.findFirst({ where: { id: input.cursor, customerId: input.id, organizationId: ctx.organizationId } })) notFound()
    return getCustomerAppointments(ctx.prisma, ctx.organizationId, input)
  }),
  listNotes: permissionProcedure({ customers: ["read"] }).input(idInput.extend(paginationInput.shape)).query(async ({ ctx, input }) => {
    if (!await ctx.prisma.customer.findFirst({ where: { id: input.id, organizationId: ctx.organizationId } })) notFound()
    if (input.cursor && !await ctx.prisma.customerNote.findFirst({ where: { id: input.cursor, customerId: input.id, organizationId: ctx.organizationId } })) notFound()
    const rows = await ctx.prisma.customerNote.findMany({
      where: { customerId: input.id, organizationId: ctx.organizationId },
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, body: true, authorUserId: true, createdAt: true, updatedAt: true },
    })
    const hasMore = rows.length > input.limit
    if (hasMore) rows.pop()
    const authors = await ctx.prisma.user.findMany({ where: { id: { in: [...new Set(rows.flatMap((note) => note.authorUserId ? [note.authorUserId] : []))] } }, select: { id: true, name: true } })
    return { items: rows.map((note) => ({ ...note, authorName: authors.find((author) => author.id === note.authorUserId)?.name ?? null })), nextCursor: hasMore ? rows.at(-1)?.id : undefined }
  }),
  addNote: permissionProcedure({ customers: ["update"] }).input(idInput.extend(customerNoteSchema.shape)).mutation(async ({ ctx, input }) => {
    if (!await ctx.prisma.customer.findFirst({ where: { id: input.id, organizationId: ctx.organizationId } })) notFound()
    return ctx.prisma.customerNote.create({ data: { customerId: input.id, organizationId: ctx.organizationId, authorUserId: ctx.user.id, body: input.body } })
  }),
  updateNote: permissionProcedure({ customers: ["update"] }).input(idInput.extend({ noteId: idInput.shape.id, ...customerNoteSchema.shape })).mutation(async ({ ctx, input }) => {
    const result = await ctx.prisma.customerNote.updateMany({ where: { id: input.noteId, customerId: input.id, organizationId: ctx.organizationId }, data: { body: input.body } })
    if (!result.count) notFound()
    return { success: true }
  }),
} satisfies TRPCRouterRecord
