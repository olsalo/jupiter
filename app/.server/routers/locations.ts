import { businessLocationSchema } from "~/lib/schemas/business-location"
import { generateId } from "~/lib/database/id"
import type { TRPCRouterRecord } from "@trpc/server"
import { permissionProcedure, organizationProcedure } from "../trpc"
import { idInput, locationInput, locationUpdateInput } from "~/lib/schemas/appointments"
import { notFound, schedulingLock } from "../services/scheduling"

export const locationRouter = {
  businessDetails: organizationProcedure.query(async ({ ctx }) => {
    const defaultId = ctx.organization.settings?.defaultLocationId
    const location = (defaultId ? await ctx.prisma.location.findFirst({ where: { id: defaultId, organizationId: ctx.organizationId, isActive: true } }) : null)
      ?? await ctx.prisma.location.findFirst({ where: { organizationId: ctx.organizationId, isActive: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
    return {
      id: location?.id ?? null,
      name: location?.name ?? ctx.organization.name,
      addressLine1: location?.addressLine1 ?? "",
      addressLine2: location?.addressLine2 ?? "",
      postalCode: location?.postalCode ?? "",
      city: location?.city ?? "",
      country: (location?.country ?? ctx.organization.settings?.countryCode ?? "FI").toUpperCase(),
      phone: location?.phone ?? "",
      email: location?.email ?? "",
    }
  }),
  saveBusinessDetails: permissionProcedure({ business: ["configure"], locations: ["configure"] }).input(businessLocationSchema).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    const { id, ...values } = input
    const data = { ...values, addressLine1: values.addressLine1 || null, addressLine2: values.addressLine2 || null, postalCode: values.postalCode || null, city: values.city || null, phone: values.phone || null, email: values.email || null }
    if (id) {
      if (!await tx.location.findFirst({ where: { id, organizationId: ctx.organizationId, isActive: true } })) notFound()
      const location = await tx.location.update({ where: { id, organizationId: ctx.organizationId }, data })
      return { ...values, id: location.id }
    }
    // Reuse a location created while this form was open instead of creating duplicates
    const current = await tx.location.findFirst({ where: { organizationId: ctx.organizationId, isActive: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
    const location = current
      ? await tx.location.update({ where: { id: current.id, organizationId: ctx.organizationId }, data })
      : await tx.location.create({ data: { ...data, organizationId: ctx.organizationId, slug: generateId().toLowerCase() } })
    return { ...values, id: location.id }
  })),
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
