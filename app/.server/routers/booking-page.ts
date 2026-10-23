import { TRPCError, type TRPCRouterRecord } from "@trpc/server"
import { permissionProcedure } from "../trpc"
import { schedulingLock } from "../services/scheduling"
import { adminBookingPageFormSchema, adminBookingPageSchema } from "~/lib/schemas/admin-booking-page"
import { z } from "~/lib/zod"

const configure = permissionProcedure({ bookingPage: ["configure"] })

export const bookingPageRouter = {
  get: configure.query(async ({ ctx }) => {
    const defaultId = ctx.organization.settings?.defaultBookingPageId
    const page = (defaultId ? await ctx.prisma.bookingPage.findFirst({ where: { id: defaultId, organizationId: ctx.organizationId }, include: { services: { orderBy: { sortOrder: "asc" } }, staff: { orderBy: { sortOrder: "asc" } } } }) : null)
      ?? await ctx.prisma.bookingPage.findFirst({ where: { organizationId: ctx.organizationId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { services: { orderBy: { sortOrder: "asc" } }, staff: { orderBy: { sortOrder: "asc" } } } })
    const [services, staff, locations] = await Promise.all([
      ctx.prisma.service.findMany({ where: { organizationId: ctx.organizationId, deletedAt: null, isActive: true, maxAttendees: 1, paymentRequirement: "NONE", resourceRequirements: { none: {} } }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
      ctx.prisma.staffMember.findMany({ where: { organizationId: ctx.organizationId, isActive: true, acceptsAppointments: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      ctx.prisma.location.findMany({ where: { organizationId: ctx.organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ])
    return {
      organization: { name: ctx.organization.name, slug: ctx.organization.slug, logo: ctx.organization.logo },
      publicPath: `/book/${encodeURIComponent(ctx.organization.slug)}${page ? `/${encodeURIComponent(page.slug)}` : ""}`,
      bookingEnabled: ctx.organization.settings?.bookingEnabled ?? true,
      published: (ctx.organization.settings?.bookingEnabled ?? true) && (page?.isActive ?? true),
      services, staff, locations,
      values: {
        slug: page?.slug ?? "booking",
        accentColor: page?.accentColor ?? null,
        title: page?.title ?? "", description: page?.description ?? "", successMessage: page?.successMessage ?? "",
        isActive: page?.isActive ?? true, allowStaffSelection: page?.allowStaffSelection ?? true, allowLocationSelection: page?.allowLocationSelection ?? true,
        defaultLocationId: page?.defaultLocationId ?? ctx.organization.settings?.defaultLocationId ?? "",
        serviceIds: page?.services.map((link) => link.serviceId) ?? [], staffIds: page?.staff.map((link) => link.staffMemberId) ?? [],
      },
    }
  }),
  updateSwitches: configure.input(adminBookingPageSchema.pick({ isActive: true, allowStaffSelection: true }).partial().refine((values) => Object.keys(values).length > 0)).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    const settings = await tx.organizationSettings.findUnique({ where: { organizationId: ctx.organizationId } })
    const current = (settings?.defaultBookingPageId ? await tx.bookingPage.findFirst({ where: { id: settings.defaultBookingPageId, organizationId: ctx.organizationId } }) : null)
      ?? await tx.bookingPage.findFirst({ where: { organizationId: ctx.organizationId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
    const page = current
      ? await tx.bookingPage.update({ where: { id: current.id, organizationId: ctx.organizationId }, data: input })
      : await tx.bookingPage.create({ data: { organizationId: ctx.organizationId, name: ctx.organization.name, slug: "booking", ...input } })
    await tx.organizationSettings.upsert({ where: { organizationId: ctx.organizationId }, create: { organizationId: ctx.organizationId, defaultBookingPageId: page.id }, update: { defaultBookingPageId: page.id } })
    return { slug: page.slug, isActive: page.isActive, allowStaffSelection: page.allowStaffSelection }
  })),
  save: configure.input(adminBookingPageFormSchema).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    const invalid = (field: "serviceIds" | "staffIds" | "defaultLocationId") => {
      throw new TRPCError({ code: "BAD_REQUEST", cause: new z.ZodError([{ code: "custom", path: [field], message: ctx.locale === "fi" ? "Valinta ei ole enää käytettävissä" : "This selection is no longer available" }]) })
    }
    const serviceIds = [...new Set(input.serviceIds)]
    const staffIds = [...new Set(input.staffIds)]
    if (await tx.service.count({ where: { id: { in: serviceIds }, organizationId: ctx.organizationId, deletedAt: null, isActive: true, maxAttendees: 1, paymentRequirement: "NONE", resourceRequirements: { none: {} } } }) !== serviceIds.length) invalid("serviceIds")
    if (await tx.staffMember.count({ where: { id: { in: staffIds }, organizationId: ctx.organizationId, isActive: true, acceptsAppointments: true } }) !== staffIds.length) invalid("staffIds")
    if (input.defaultLocationId && !await tx.location.findFirst({ where: { id: input.defaultLocationId, organizationId: ctx.organizationId, isActive: true } })) invalid("defaultLocationId")
    const settings = await tx.organizationSettings.findUnique({ where: { organizationId: ctx.organizationId } })
    const current = (settings?.defaultBookingPageId ? await tx.bookingPage.findFirst({ where: { id: settings.defaultBookingPageId, organizationId: ctx.organizationId } }) : null)
      ?? await tx.bookingPage.findFirst({ where: { organizationId: ctx.organizationId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
    if (await tx.bookingPage.findFirst({ where: { organizationId: ctx.organizationId, slug: input.slug, ...(current ? { id: { not: current.id } } : {}) } })) {
      throw new TRPCError({ code: "BAD_REQUEST", cause: new z.ZodError([{ code: "custom", path: ["slug"], message: ctx.locale === "fi" ? "Tämä osoite on jo käytössä" : "This URL is already in use" }]) })
    }
    const { serviceIds: _services, staffIds: _staff, ...values } = input
    const data = { ...values, title: input.title || null, description: input.description || null, successMessage: input.successMessage || null, defaultLocationId: input.defaultLocationId || null, requireServiceSelection: true }
    const page = current
      ? await tx.bookingPage.update({ where: { id: current.id, organizationId: ctx.organizationId }, data })
      : await tx.bookingPage.create({ data: { ...data, organizationId: ctx.organizationId, name: ctx.organization.name } })
    await tx.bookingPageService.deleteMany({ where: { bookingPageId: page.id } })
    await tx.bookingPageStaff.deleteMany({ where: { bookingPageId: page.id } })
    if (serviceIds.length) await tx.bookingPageService.createMany({ data: serviceIds.map((serviceId, sortOrder) => ({ bookingPageId: page.id, serviceId, sortOrder })) })
    if (staffIds.length) await tx.bookingPageStaff.createMany({ data: staffIds.map((staffMemberId, sortOrder) => ({ bookingPageId: page.id, staffMemberId, sortOrder })) })
    await tx.organizationSettings.upsert({ where: { organizationId: ctx.organizationId }, create: { organizationId: ctx.organizationId, defaultBookingPageId: page.id }, update: { defaultBookingPageId: page.id } })
    return { ...input, serviceIds, staffIds }
  })),
} satisfies TRPCRouterRecord
