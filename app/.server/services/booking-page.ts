import { bookingPageImagePath, getBookingPageImageKey } from "~/lib/booking/booking-page-image"
import { getHiddenBookingPageServiceIds } from "~/lib/booking/booking-page-services"
import { TRPCError } from "@trpc/server"
import { notFound, type Database } from "./scheduling"
import { assertOrganizationSubscription } from "~/lib/billing/billing.server.ts"

export async function resolveBookingPage(db: Database, input: { organizationSlug: string; bookingPageSlug?: string; serviceId?: string; staffMemberId?: string; locationId?: string }) {
  const organization = await db.organization.findUnique({ where: { slug: input.organizationSlug }, include: { settings: true } })
  if (!organization || !organization.settings?.bookingEnabled) notFound()
  await assertOrganizationSubscription(organization.id, db)
  const defaultPageId = organization.settings.defaultBookingPageId
  const page = input.bookingPageSlug || defaultPageId ? await db.bookingPage.findFirst({ where: { organizationId: organization.id, ...(input.bookingPageSlug ? { slug: input.bookingPageSlug } : { id: defaultPageId! }), isActive: true }, include: { services: true, staff: true } }) : null
  if ((input.bookingPageSlug || defaultPageId) && !page) notFound()
  const defaultLocationId = page?.defaultLocationId ?? organization.settings.defaultLocationId
  const service = defaultLocationId && input.serviceId && !input.locationId
    ? await db.service.findFirst({ where: { id: input.serviceId, organizationId: organization.id }, select: { deliveryType: true, serviceLocations: { where: { isActive: true }, select: { locationId: true } } } })
    : null
  const remoteWithoutLocation = service && ["ONLINE", "PHONE"].includes(service.deliveryType) && service.serviceLocations.length === 0
  const hiddenServiceIds = getHiddenBookingPageServiceIds(page?.metadata)
  if (page && input.serviceId && page.services.length && (hiddenServiceIds.includes(input.serviceId) || !page.services.some((link) => link.serviceId === input.serviceId))) notFound()
  if (page && input.staffMemberId && (!page.allowStaffSelection || (page.staff.length && !page.staff.some((link) => link.staffMemberId === input.staffMemberId)))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose staff through this booking page" })
  }
  if (page && input.locationId && !page.allowLocationSelection && input.locationId !== defaultLocationId) notFound()
  return { organization, page,
    locationId: input.locationId ?? (remoteWithoutLocation ? undefined : defaultLocationId ?? undefined),
    allowedStaffIds: page?.staff.length ? page.staff.map((link) => link.staffMemberId) : undefined,
  }
}

export async function getBookingPage(db: Database, input: { organizationSlug: string; bookingPageSlug?: string }) {
  const { organization, page, allowedStaffIds } = await resolveBookingPage(db, input)
  const hiddenServiceIds = new Set(getHiddenBookingPageServiceIds(page?.metadata))
  const serviceWhere = { organizationId: organization.id, deletedAt: null, isActive: true, maxAttendees: 1, paymentRequirement: "NONE" as const, resourceRequirements: { none: {} }, ...(page?.services.length ? { id: { in: page.services.filter((link) => !hiddenServiceIds.has(link.serviceId)).map((link) => link.serviceId) } } : {}) }
  const now = new Date()
  const [services, staff, locations, questions, openingRules] = await Promise.all([
    db.service.findMany({ where: serviceWhere, select: { id: true, name: true, slug: true, description: true, category: { select: { id: true, name: true, description: true, sortOrder: true, isActive: true, organizationId: true } }, durationMinutes: true, price: true, currency: true, deliveryType: true, requiresConfirmation: true, maxBookingAdvanceDays: true, cancellationNoticeMinutes: true, rescheduleNoticeMinutes: true, serviceLocations: { where: { isActive: true, location: { isActive: true } }, select: { locationId: true } } }, orderBy: { name: "asc" } }),
    db.staffMember.findMany({ where: { organizationId: organization.id, isActive: true, acceptsAppointments: true, ...(allowedStaffIds ? { id: { in: allowedStaffIds } } : {}), staffServices: { some: { isActive: true, service: serviceWhere } } }, select: { id: true, name: true, bio: true, image: true, staffLocations: { where: { isActive: true, location: { isActive: true } }, select: { locationId: true } }, staffServices: { where: { isActive: true, service: serviceWhere }, select: { serviceId: true } } }, orderBy: { name: "asc" } }),
    db.location.findMany({ where: { organizationId: organization.id, isActive: true, serviceLocations: { some: { isActive: true, service: serviceWhere } } }, select: { id: true, name: true, addressLine1: true, city: true, country: true, timezone: true, bookingInstructions: true } }),
    db.bookingQuestion.findMany({ where: { organizationId: organization.id, isActive: true, OR: [{ serviceId: null }, { service: serviceWhere }] }, select: { id: true, serviceId: true, label: true, description: true, type: true, placeholder: true, options: true, required: true }, orderBy: { sortOrder: "asc" } }),
    db.availabilityRule.findMany({
      where: { organizationId: organization.id, staffMemberId: null, locationId: null, isBreak: false, AND: [{ OR: [{ validFrom: null }, { validFrom: { lte: now } }] }, { OR: [{ validUntil: null }, { validUntil: { gt: now } }] }] },
      select: { dayOfWeek: true, startMinute: true, endMinute: true, isActive: true },
      orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
    }),
  ])
  if (page?.services.length) {
    const order = new Map(page.services.map((link) => [link.serviceId, link.sortOrder]))
    services.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  }
  const settings = organization.settings!
  const openingHours = openingRules.length
    ? openingRules.filter((rule) => rule.isActive).map(({ dayOfWeek, startMinute, endMinute }) => ({ dayOfWeek, startMinute, endMinute }))
    : [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startMinute: settings.defaultStartHour * 60, endMinute: settings.defaultEndHour * 60 }))
  return { openingHours, organization: { name: organization.name, slug: organization.slug, logo: organization.logo },
    page: page ? { imageUrl: getBookingPageImageKey(page.metadata) ? bookingPageImagePath(organization.slug, page.slug, getBookingPageImageKey(page.metadata)!) : null, accentColor: page.accentColor, slug: page.slug, title: page.title, description: page.description, successMessage: page.successMessage, allowStaffSelection: page.allowStaffSelection, allowLocationSelection: page.allowLocationSelection, defaultLocationId: page.defaultLocationId ?? organization.settings?.defaultLocationId ?? null } : null,
    settings: { autoConfirmAppointments: settings.autoConfirmAppointments, maxBookingAdvanceDays: settings.maxBookingAdvanceDays, cancellationNoticeMinutes: settings.cancellationNoticeMinutes, rescheduleNoticeMinutes: settings.rescheduleNoticeMinutes, timezone: settings.bookingTimezone ?? settings.timezone, weekStartsOn: settings.weekStartsOn, defaultLocationId: settings.defaultLocationId, currency: settings.currency, requireCustomerEmail: settings.requireCustomerEmail, requireCustomerPhone: settings.requireCustomerPhone, allowCustomerCancellation: settings.allowCustomerCancellation, allowCustomerRescheduling: settings.allowCustomerRescheduling },
    services: services.filter((service) => staff.some((person) => person.staffServices.some((link) => link.serviceId === service.id) && (!service.serviceLocations.length || service.serviceLocations.some((location) => person.staffLocations.some((link) => link.locationId === location.locationId))))).map((service) => ({
      ...service,
      category: service.category?.isActive && service.category.organizationId === organization.id
        ? { id: service.category.id, name: service.category.name, description: service.category.description, sortOrder: service.category.sortOrder }
        : null,
      price: service.price?.toString() ?? null,
    })), staff, locations, questions,
  }
}
