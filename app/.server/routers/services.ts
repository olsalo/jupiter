import { serializeService } from "../services/serialization"
import type { TRPCRouterRecord } from "@trpc/server"
import { permissionProcedure, organizationProcedure } from "../trpc"
import { assignmentInput, idInput, serviceCreateInput, serviceUpdateInput } from "~/lib/schemas/appointments"
import { TRPCError } from "@trpc/server"
import { generateId } from "~/lib/id"
import { z } from "~/lib/zod"
import { notFound, schedulingLock } from "../services/scheduling"
import { serviceCategorySchema } from "~/lib/schemas/services"

export const serviceRouter = {
  bookingUsage: organizationProcedure.query(async ({ ctx }) => {
    const counts = await ctx.prisma.appointmentService.groupBy({
      by: ["serviceId"],
      where: { appointment: { organizationId: ctx.organizationId, status: { notIn: ["CANCELLED", "NO_SHOW"] } }, service: { organizationId: ctx.organizationId, deletedAt: null, isActive: true } },
      _count: { _all: true },
    })
    return counts.map((item) => ({ serviceId: item.serviceId, bookings: item._count._all }))
  }),
  categories: organizationProcedure.query(({ ctx }) => ctx.prisma.serviceCategory.findMany({
    where: { organizationId: ctx.organizationId, isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
  })),
  createCategory: permissionProcedure({ services: ["configure"] }).input(serviceCategorySchema((key) => key)).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    if (await tx.serviceCategory.findFirst({ where: { organizationId: ctx.organizationId, isActive: true, name: { equals: input.name, mode: "insensitive" } } })) {
      throw new TRPCError({ code: "BAD_REQUEST", cause: new z.ZodError([{ code: "custom", path: ["name"], message: "categoryNameTaken" }]) })
    }
    if (await tx.service.count({ where: { id: { in: input.serviceIds }, organizationId: ctx.organizationId, deletedAt: null } }) !== input.serviceIds.length) {
      throw new TRPCError({ code: "BAD_REQUEST", cause: new z.ZodError([{ code: "custom", path: ["serviceIds"], message: "invalidAssignment" }]) })
    }
    const last = await tx.serviceCategory.aggregate({ where: { organizationId: ctx.organizationId }, _max: { sortOrder: true } })
    const category = await tx.serviceCategory.create({ data: { name: input.name, organizationId: ctx.organizationId, sortOrder: (last._max.sortOrder ?? -1) + 1 } })
    await tx.service.updateMany({ where: { id: { in: input.serviceIds }, organizationId: ctx.organizationId, deletedAt: null }, data: { categoryId: category.id } })
    return category
  })),
  updateCategory: permissionProcedure({ services: ["configure"] }).input(serviceCategorySchema((key) => key).extend(idInput.shape)).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    if (!await tx.serviceCategory.findFirst({ where: { id: input.id, organizationId: ctx.organizationId, isActive: true } })) notFound()
    if (await tx.serviceCategory.findFirst({ where: { id: { not: input.id }, organizationId: ctx.organizationId, isActive: true, name: { equals: input.name, mode: "insensitive" } } })) {
      throw new TRPCError({ code: "BAD_REQUEST", cause: new z.ZodError([{ code: "custom", path: ["name"], message: "categoryNameTaken" }]) })
    }
    if (await tx.service.count({ where: { id: { in: input.serviceIds }, organizationId: ctx.organizationId, deletedAt: null } }) !== input.serviceIds.length) {
      throw new TRPCError({ code: "BAD_REQUEST", cause: new z.ZodError([{ code: "custom", path: ["serviceIds"], message: "invalidAssignment" }]) })
    }
    const category = await tx.serviceCategory.update({ where: { id: input.id, organizationId: ctx.organizationId }, data: { name: input.name } })
    await tx.service.updateMany({ where: { organizationId: ctx.organizationId, deletedAt: null, categoryId: input.id, id: { notIn: input.serviceIds } }, data: { categoryId: null } })
    await tx.service.updateMany({ where: { organizationId: ctx.organizationId, id: { in: input.serviceIds } }, data: { categoryId: input.id } })
    return category
  })),
  deleteCategory: permissionProcedure({ services: ["configure"] }).input(idInput).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    if (!await tx.serviceCategory.findFirst({ where: { id: input.id, organizationId: ctx.organizationId, isActive: true } })) notFound()
    await tx.service.updateMany({ where: { organizationId: ctx.organizationId, categoryId: input.id }, data: { categoryId: null } })
    await tx.serviceCategory.delete({ where: { id: input.id, organizationId: ctx.organizationId } })
    return { id: input.id }
  })),
  list: organizationProcedure.query(({ ctx }) => ctx.prisma.service.findMany({ where: { organizationId: ctx.organizationId, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }] }).then((services) => services.map(serializeService))),
  reorder: permissionProcedure({ services: ["configure"] }).input(z.object({ ids: z.array(z.string().min(1)).refine((ids) => new Set(ids).size === ids.length) })).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    const services = await tx.service.findMany({ where: { organizationId: ctx.organizationId, deletedAt: null }, select: { id: true } })
    const ids = new Set(input.ids)
    if (services.length !== ids.size || services.some((service) => !ids.has(service.id))) {
      throw new TRPCError({ code: "CONFLICT", message: "The service list changed. Reload and try again" })
    }
    for (const [sortOrder, id] of input.ids.entries()) {
      await tx.service.update({ where: { id, organizationId: ctx.organizationId, deletedAt: null }, data: { sortOrder } })
    }
    return { ids: input.ids }
  })),
  get: organizationProcedure.input(idInput).query(async ({ ctx, input }) => {
    const service = await ctx.prisma.service.findFirst({ where: { id: input.id, organizationId: ctx.organizationId, deletedAt: null }, include: { category: true, staffServices: true, serviceLocations: true } })
    if (!service) notFound()
    return serializeService(service)
  }),
  create: permissionProcedure({ services: ["configure"] }).input(serviceCreateInput).mutation(({ ctx, input: { staffIds, locationIds, ...input } }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    for (const [field, count, expected] of [
      ["staffIds", await tx.staffMember.count({ where: { id: { in: staffIds }, organizationId: ctx.organizationId, isActive: true, acceptsAppointments: true } }), staffIds.length],
      ["locationIds", await tx.location.count({ where: { id: { in: locationIds }, organizationId: ctx.organizationId, isActive: true } }), locationIds.length],
    ] as const) {
      if (count !== expected) throw new TRPCError({ code: "BAD_REQUEST", cause: new z.ZodError([{ code: "custom", path: [field], message: "invalidAssignment" }]) })
    }
    if (input.categoryId && !await tx.serviceCategory.findFirst({ where: { id: input.categoryId, organizationId: ctx.organizationId, isActive: true } })) {
      throw new TRPCError({ code: "BAD_REQUEST", cause: new z.ZodError([{ code: "custom", path: ["categoryId"], message: "invalidAssignment" }]) })
    }
    const slugBase = input.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "service"
    const lastService = await tx.service.aggregate({ where: { organizationId: ctx.organizationId }, _max: { sortOrder: true } })
    return tx.service.create({ data: {
      ...input, sortOrder: (lastService._max.sortOrder ?? -1) + 1,
      slug: input.slug ?? `${slugBase}-${generateId().toLowerCase()}`,
      currency: input.currency ?? ctx.organization.settings?.currency ?? "EUR", organizationId: ctx.organizationId,
      staffServices: { create: staffIds.map((staffMemberId) => ({ staffMemberId })) },
      serviceLocations: { create: locationIds.map((locationId) => ({ locationId })) },
    } })
  }).then(serializeService)),
  update: permissionProcedure({ services: ["configure"] }).input(serviceUpdateInput).mutation(({ ctx, input: { id, staffIds, locationIds, ...data } }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    const existing = await tx.service.findFirst({ where: { id, organizationId: ctx.organizationId, deletedAt: null } })
    if (!existing) notFound()
    if (data.categoryId && data.categoryId !== existing.categoryId && !await tx.serviceCategory.findFirst({ where: { id: data.categoryId, organizationId: ctx.organizationId, isActive: true } })) {
      throw new TRPCError({ code: "BAD_REQUEST", cause: new z.ZodError([{ code: "custom", path: ["categoryId"], message: "invalidAssignment" }]) })
    }
    if (staffIds && await tx.staffMember.count({ where: { id: { in: staffIds }, organizationId: ctx.organizationId, OR: [{ isActive: true, acceptsAppointments: true }, { staffServices: { some: { serviceId: id } } }] } }) !== staffIds.length) {
      throw new TRPCError({ code: "BAD_REQUEST", cause: new z.ZodError([{ code: "custom", path: ["staffIds"], message: "invalidAssignment" }]) })
    }
    if (locationIds && await tx.location.count({ where: { id: { in: locationIds }, organizationId: ctx.organizationId, OR: [{ isActive: true }, { serviceLocations: { some: { serviceId: id } } }] } }) !== locationIds.length) {
      throw new TRPCError({ code: "BAD_REQUEST", cause: new z.ZodError([{ code: "custom", path: ["locationIds"], message: "invalidAssignment" }]) })
    }
    if (staffIds) {
      await tx.staffService.deleteMany({ where: { serviceId: id, staffMemberId: { notIn: staffIds } } })
      for (const staffMemberId of staffIds) await tx.staffService.upsert({ where: { staffMemberId_serviceId: { staffMemberId, serviceId: id } }, create: { staffMemberId, serviceId: id }, update: { isActive: true } })
    }
    if (locationIds) {
      await tx.serviceLocation.deleteMany({ where: { serviceId: id, locationId: { notIn: locationIds } } })
      for (const locationId of locationIds) await tx.serviceLocation.upsert({ where: { serviceId_locationId: { serviceId: id, locationId } }, create: { serviceId: id, locationId }, update: { isActive: true } })
    }
    return tx.service.update({ where: { id, organizationId: ctx.organizationId, deletedAt: null }, data })
  }).then(serializeService)),
  delete: permissionProcedure({ services: ["configure"] }).input(idInput).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    const deleted = await tx.service.updateMany({ where: { id: input.id, organizationId: ctx.organizationId, deletedAt: null }, data: { deletedAt: new Date() } })
    if (!deleted.count) notFound()
    return { id: input.id }
  })),
  archive: permissionProcedure({ services: ["configure"] }).input(idInput).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    if (!await tx.service.findFirst({ where: { id: input.id, organizationId: ctx.organizationId, deletedAt: null } })) notFound()
    return tx.service.update({ where: { id: input.id, organizationId: ctx.organizationId, deletedAt: null }, data: { isActive: false } })
  }).then(serializeService)),
  setLocations: permissionProcedure({ services: ["configure"] }).input(assignmentInput).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    if (!await tx.service.findFirst({ where: { id: input.id, organizationId: ctx.organizationId, deletedAt: null } })) notFound()
    if (await tx.location.count({ where: { id: { in: input.ids }, organizationId: ctx.organizationId } }) !== input.ids.length) notFound()
    await tx.serviceLocation.deleteMany({ where: { serviceId: input.id, service: { organizationId: ctx.organizationId } } })
    await tx.serviceLocation.createMany({ data: input.ids.map((locationId) => ({ serviceId: input.id, locationId })) })
    return { id: input.id }
  })),
} satisfies TRPCRouterRecord
