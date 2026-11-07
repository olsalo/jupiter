import { getHiddenBookingPageServiceIds } from "~/lib/booking/booking-page-services"
import { showBookingNotifications } from "~/lib/booking/booking-page-notifications"
import { resolveBookingPage } from "./booking-page"
import type { Database } from "./scheduling"
import type { Prisma } from "../../../generated/prisma/client"

export async function getRecentBookings(db: Database, input: { organizationSlug: string; bookingPageSlug?: string }) {
  const { organization, page, allowedStaffIds, locationId } = await resolveBookingPage(db, input)
  if (!showBookingNotifications(page?.metadata)) return []
  const hiddenServiceIds = getHiddenBookingPageServiceIds(page?.metadata)
  const serviceIds = page?.services.length
    ? page.services.filter((link) => !hiddenServiceIds.includes(link.serviceId)).map((link) => link.serviceId)
    : undefined
  const services = {
    service: {
      organizationId: organization.id,
      isActive: true,
      deletedAt: null,
      maxAttendees: 1,
      paymentRequirement: "NONE" as const,
      resourceRequirements: { none: {} },
      ...(serviceIds ? { id: { in: serviceIds } } : {}),
    },
  }
  const where: Prisma.AppointmentWhereInput = {
    organizationId: organization.id,
    source: "PUBLIC_BOOKING",
    status: { in: ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"] },
    ...(allowedStaffIds ? { staffMemberId: { in: allowedStaffIds } } : {}),
    ...(locationId && page?.allowLocationSelection === false ? { locationId } : {}),
    services: { some: services },
  }
  const select = {
    id: true,
    startsAt: true,
    services: { where: services, select: { name: true }, orderBy: { createdAt: "asc" }, take: 1 },
  } satisfies Prisma.AppointmentSelect
  const now = new Date()
  const [recent, upcoming] = await Promise.all([
    db.appointment.findMany({
      where: { ...where, createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
      select,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 25,
    }),
    db.appointment.findMany({
      where: { ...where, startsAt: { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) } },
      select,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: 25,
    }),
  ])
  const bookings = [...new Map([...recent, ...upcoming].map((booking) => [booking.id, booking])).values()]
  return bookings.flatMap((booking) => booking.services[0]
    ? [{ id: booking.id, serviceName: booking.services[0].name, startsAt: booking.startsAt }]
    : [])
}
