import { TRPCError, type TRPCRouterRecord } from "@trpc/server"
import { permissionProcedure } from "../trpc"
import { schedulingLock } from "../services/scheduling"
import { adminBookingPageFormSchema, adminBookingPageSchema } from "~/lib/schemas/admin-booking-page"
import { getHiddenBookingPageServiceIds } from "~/lib/booking/booking-page-services"
import { z } from "~/lib/validation/zod"

import { deleteObject, isObjectStorageReady, getObjectUrl, verifyObject } from "~/lib/storage/object-storage.server"
import { isScopedImageKey } from "~/lib/storage/image-upload.server"
import { uploadBookingImage } from "../services/booking-image-upload"
import { imageUploadSchema } from "~/lib/storage/image-upload"
import { getBookingPageImageKey } from "~/lib/booking/booking-page-image"

const configure = permissionProcedure({ bookingPage: ["configure"] })

export const bookingPageRouter = {
  uploadImage: configure.input(imageUploadSchema).mutation(({ ctx, input }) => uploadBookingImage(ctx.prisma, ctx.organizationId, input.base64)),
  get: configure.query(async ({ ctx }) => {
    const defaultId = ctx.organization.settings?.defaultBookingPageId
    const page = (defaultId ? await ctx.prisma.bookingPage.findFirst({ where: { id: defaultId, organizationId: ctx.organizationId }, include: { services: { orderBy: { sortOrder: "asc" } }, staff: { orderBy: { sortOrder: "asc" } } } }) : null)
      ?? await ctx.prisma.bookingPage.findFirst({ where: { organizationId: ctx.organizationId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { services: { orderBy: { sortOrder: "asc" } }, staff: { orderBy: { sortOrder: "asc" } } } })
    const [services, staff, locations] = await Promise.all([
      ctx.prisma.service.findMany({ where: { organizationId: ctx.organizationId, deletedAt: null, isActive: true, maxAttendees: 1, paymentRequirement: "NONE", resourceRequirements: { none: {} } }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
      ctx.prisma.staffMember.findMany({ where: { organizationId: ctx.organizationId, isActive: true, acceptsAppointments: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      ctx.prisma.location.findMany({ where: { organizationId: ctx.organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ])
    const hiddenIds = new Set(getHiddenBookingPageServiceIds(page?.metadata))
    const availableIds = new Set(services.map((service) => service.id))
    const linkedServices = page?.services.filter((link) => availableIds.has(link.serviceId)) ?? []
    const linkedIds = new Set(linkedServices.map((link) => link.serviceId))
    const unlinkedServices = services.filter((service) => !linkedIds.has(service.id))
    return {
      imageUploadEnabled: isObjectStorageReady(),
      imageUrl: isObjectStorageReady() && getBookingPageImageKey(page?.metadata) ? await getObjectUrl(getBookingPageImageKey(page?.metadata)!) : null,
      organization: { name: ctx.organization.name, slug: ctx.organization.slug, logo: ctx.organization.logo },
      publicPath: `/book/${encodeURIComponent(ctx.organization.slug)}${page ? `/${encodeURIComponent(page.slug)}` : ""}`,
      bookingEnabled: ctx.organization.settings?.bookingEnabled ?? true,
      published: (ctx.organization.settings?.bookingEnabled ?? true) && (page?.isActive ?? true),
      services, staff, locations,
      values: {
        imageKey: getBookingPageImageKey(page?.metadata),
        slug: page?.slug ?? "booking",
        accentColor: page?.accentColor ?? null,
        title: page?.title ?? "", description: page?.description ?? "", successMessage: page?.successMessage ?? "",
        isActive: page?.isActive ?? true, allowStaffSelection: page?.allowStaffSelection ?? true, allowLocationSelection: page?.allowLocationSelection ?? true,
        defaultLocationId: page?.defaultLocationId ?? ctx.organization.settings?.defaultLocationId ?? "",
        serviceIds: [...linkedServices.map((link) => link.serviceId), ...unlinkedServices.map((service) => service.id)],
        hiddenServiceIds: [...linkedServices.filter((link) => hiddenIds.has(link.serviceId)).map((link) => link.serviceId), ...(page?.services.length ? unlinkedServices.map((service) => service.id) : [])],
        staffIds: page?.staff.map((link) => link.staffMemberId) ?? [],
      },
    }
  }),
  updateImage: configure.input(adminBookingPageSchema.pick({ imageKey: true })).mutation(async ({ ctx, input }) => {
    if (input.imageKey) {
      if (!isScopedImageKey(input.imageKey, { organizationId: ctx.organizationId, folder: "booking-pages" })) {
        throw new TRPCError({ code: "BAD_REQUEST", cause: new z.ZodError([{ code: "custom", path: ["imageKey"], message: ctx.locale === "fi" ? "Valitse tämän yrityksen kuva" : "Choose an image for this business" }]) })
      }
    }
    const imageUrl = input.imageKey ? await getObjectUrl(input.imageKey) : null
    const saved = await ctx.prisma.$transaction(async (tx) => {
      await schedulingLock(tx, ctx.organizationId)
      if (input.imageKey) await verifyObject(input.imageKey)
      const settings = await tx.organizationSettings.findUnique({ where: { organizationId: ctx.organizationId } })
      const current = (settings?.defaultBookingPageId ? await tx.bookingPage.findFirst({ where: { id: settings.defaultBookingPageId, organizationId: ctx.organizationId } }) : null)
        ?? await tx.bookingPage.findFirst({ where: { organizationId: ctx.organizationId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
      const metadata = current?.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata) ? current.metadata : {}
      const previousKey = getBookingPageImageKey(current?.metadata)
      const queued = Array.isArray(metadata.pendingImageDeletionKeys) ? metadata.pendingImageDeletionKeys.filter((key): key is string => typeof key === "string") : []
      const pendingImageDeletionKeys = [...new Set([...queued, ...(previousKey ? [previousKey] : [])])]
        .filter((key) => key !== input.imageKey && isScopedImageKey(key, { organizationId: ctx.organizationId, folder: "booking-pages" }))
      const data = { metadata: { ...metadata, imageKey: input.imageKey, pendingImageDeletionKeys } }
      const page = current
        ? await tx.bookingPage.update({ where: { id: current.id, organizationId: ctx.organizationId }, data })
        : await tx.bookingPage.create({ data: { ...data, organizationId: ctx.organizationId, name: ctx.organization.name, slug: "booking" } })
      await tx.organizationSettings.upsert({ where: { organizationId: ctx.organizationId }, create: { organizationId: ctx.organizationId, defaultBookingPageId: page.id }, update: { defaultBookingPageId: page.id } })
      return { imageKey: input.imageKey, imageUrl, slug: page.slug, pageId: page.id }
    })
    // Commit the new image first so a failed database save never deletes the live image
    let cleanupPending = false
    try {
      cleanupPending = await ctx.prisma.$transaction(async (tx) => {
        await schedulingLock(tx, ctx.organizationId)
        const page = await tx.bookingPage.findUniqueOrThrow({ where: { id: saved.pageId, organizationId: ctx.organizationId } })
        const metadata = page.metadata && typeof page.metadata === "object" && !Array.isArray(page.metadata) ? page.metadata : {}
        const currentKey = getBookingPageImageKey(page.metadata)
        const queued = Array.isArray(metadata.pendingImageDeletionKeys) ? metadata.pendingImageDeletionKeys : []
        const remaining: string[] = []
        for (const key of queued) {
          if (typeof key !== "string" || key === currentKey || !isScopedImageKey(key, { organizationId: ctx.organizationId, folder: "booking-pages" })) continue
          try {
            await deleteObject(key)
          } catch {
            remaining.push(key)
          }
        }
        await tx.bookingPage.update({ where: { id: page.id }, data: { metadata: { ...metadata, pendingImageDeletionKeys: remaining } } })
        return remaining.length > 0
      })
    } catch {
      // The queue was committed with the image change and can be retried on the next change
      cleanupPending = true
    }
    return { imageKey: saved.imageKey, imageUrl: saved.imageUrl, slug: saved.slug, cleanupPending }
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
    const invalid = (field: "serviceIds" | "hiddenServiceIds" | "staffIds" | "defaultLocationId") => {
      throw new TRPCError({ code: "BAD_REQUEST", cause: new z.ZodError([{ code: "custom", path: [field], message: ctx.locale === "fi" ? "Valinta ei ole enää käytettävissä" : "This selection is no longer available" }]) })
    }
    const serviceIds = [...new Set(input.serviceIds)]
    if (input.hiddenServiceIds.some((id) => !serviceIds.includes(id))) invalid("hiddenServiceIds")
    const hiddenServiceIds = serviceIds.filter((id) => input.hiddenServiceIds.includes(id))
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
    const { serviceIds: _services, hiddenServiceIds: _hiddenServices, staffIds: _staff, ...values } = input
    const metadata = current?.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata) ? current.metadata : {}
    const data = { ...values, metadata: { ...metadata, hiddenServiceIds }, title: input.title || null, description: input.description || null, successMessage: input.successMessage || null, defaultLocationId: input.defaultLocationId || null, requireServiceSelection: true }
    const page = current
      ? await tx.bookingPage.update({ where: { id: current.id, organizationId: ctx.organizationId }, data })
      : await tx.bookingPage.create({ data: { ...data, organizationId: ctx.organizationId, name: ctx.organization.name } })
    await tx.bookingPageService.deleteMany({ where: { bookingPageId: page.id } })
    await tx.bookingPageStaff.deleteMany({ where: { bookingPageId: page.id } })
    if (serviceIds.length) await tx.bookingPageService.createMany({ data: serviceIds.map((serviceId, sortOrder) => ({ bookingPageId: page.id, serviceId, sortOrder })) })
    if (staffIds.length) await tx.bookingPageStaff.createMany({ data: staffIds.map((staffMemberId, sortOrder) => ({ bookingPageId: page.id, staffMemberId, sortOrder })) })
    await tx.organizationSettings.upsert({ where: { organizationId: ctx.organizationId }, create: { organizationId: ctx.organizationId, defaultBookingPageId: page.id }, update: { defaultBookingPageId: page.id } })
    return { ...input, serviceIds, hiddenServiceIds, staffIds }
  })),
} satisfies TRPCRouterRecord
