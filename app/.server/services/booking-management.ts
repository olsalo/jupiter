import { savedBookingPolicy } from "./booking-policy"
import { publicAppointment } from "./appointments"
import { notFound, type Database } from "./scheduling"

export async function bookingManagementContext(db: Database, bookingCode: string) {
  const appointment = await db.appointment.findUnique({
    where: { bookingCode },
    include: {
      services: { include: { service: true } },
      organization: { include: { settings: true } },
      location: { select: { email: true, phone: true } },
    },
  })
  if (!appointment) notFound()
  const snapshot = appointment.services[0]
  const settings = appointment.organization.settings
  const policy = savedBookingPolicy(appointment, settings, snapshot?.service ?? null)
  const notice = policy.rescheduleNoticeMinutes
  const deadline = new Date(+appointment.startsAt - notice * 60000)
  const expired = appointment.status === "PENDING" && Boolean(appointment.expiresAt && +appointment.expiresAt <= Date.now())
  const cancellationNotice = policy.cancellationNoticeMinutes
  const cancellationDeadline = new Date(+appointment.startsAt - cancellationNotice * 60000)
  const canCancel = Boolean(
    ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(appointment.status) &&
    policy.allowCustomerCancellation && +cancellationDeadline > Date.now() && !expired,
  )
  const canReschedule = Boolean(
    ["PENDING", "CONFIRMED"].includes(appointment.status) &&
    appointment.staffMemberId && snapshot &&
    policy.allowCustomerRescheduling &&
    +deadline > Date.now() &&
    !expired,
  )
  return { appointment, snapshot, settings, policy, deadline, canReschedule, canCancel, cancellationDeadline, expired }
}

export async function getBookingManagementPage(db: Database, bookingCode: string) {
  const { appointment, snapshot, settings, policy, deadline, canReschedule, canCancel, cancellationDeadline, expired } = await bookingManagementContext(db, bookingCode)
  const page = (settings?.defaultBookingPageId ? await db.bookingPage.findFirst({
    where: { id: settings.defaultBookingPageId, organizationId: appointment.organizationId },
    select: { accentColor: true },
  }) : null) ?? await db.bookingPage.findFirst({
    where: { organizationId: appointment.organizationId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { accentColor: true },
  })
  return {
    accentColor: page?.accentColor ?? null,
    booking: await publicAppointment(db, bookingCode),
    organization: {
      name: appointment.organization.name,
      logo: appointment.organization.logo,
      slug: appointment.organization.slug,
    },
    contact: appointment.location,
    canReschedule,
    canCancel,
    cancellationDeadline,
    expired,
    deadline,
    maxBookingAdvanceDays: policy.maxBookingAdvanceDays ?? 730,
  }
}

