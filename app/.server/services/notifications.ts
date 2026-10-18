import { formatDateTime, getFormatPreferenceFromCountry } from "~/lib/format-preference"
import type { NotificationKind, Prisma } from "../../../generated/prisma/client"
import type { Database } from "./scheduling"

const notificationInclude = { customer: true, organization: { include: { settings: true } }, services: true } as const
type NotificationAppointment = Prisma.AppointmentGetPayload<{ include: typeof notificationInclude }>

function notificationData(appointment: NotificationAppointment, kind: NotificationKind, offsetMinutes?: number): Prisma.NotificationCreateManyInput | null {
  if (!appointment.customer.email) return null
  const settings = appointment.organization.settings
  if ((kind === "BOOKING_CONFIRMATION" && settings?.sendBookingConfirmations === false) || (kind === "CANCELLATION" && settings?.sendCancellationEmails === false) || (kind === "RESCHEDULE" && settings?.sendRescheduleEmails === false) || (kind === "REMINDER" && settings?.enableAppointmentReminders === false)) return null
  const labels = { BOOKING_CONFIRMATION: "Booking received", CANCELLATION: "Booking cancelled", RESCHEDULE: "Booking rescheduled", REMINDER: "Appointment reminder" } as const
  const subject = kind in labels ? labels[kind as keyof typeof labels] : "Appointment update"
  const time = formatDateTime(appointment.startsAt, { formatPreference: getFormatPreferenceFromCountry(settings?.location ?? "FI"), language: appointment.customer.locale === "fi" ? "fi" : "en", timeZone: appointment.timezone })
  const body = `${appointment.organization.name}\n${appointment.services.map((service) => service.name).join(", ")}\n${time}\nBooking code: ${appointment.bookingCode}`
  const scheduledAt = kind === "REMINDER" ? new Date(+appointment.startsAt - offsetMinutes! * 60000) : new Date()
  if (kind === "REMINDER" && scheduledAt <= new Date()) return null
  return { organizationId: appointment.organizationId, appointmentId: appointment.id, kind, channel: "EMAIL", status: kind === "REMINDER" ? "SCHEDULED" : "PENDING", recipient: appointment.customer.email, subject, body, scheduledAt, metadata: kind === "REMINDER" ? { reminderOffsetMinutes: offsetMinutes! } : undefined }
}

export async function queueNotification(tx: Database, organizationId: string, appointmentId: string, kind: NotificationKind) {
  const appointment = await tx.appointment.findFirst({ where: { id: appointmentId, organizationId }, include: notificationInclude })
  if (!appointment) return
  const offsets = kind === "REMINDER" ? appointment.organization.settings?.reminderOffsetsMinutes ?? [1440] : [undefined]
  const data = offsets.flatMap((offset) => {
    const notification = notificationData(appointment, kind, offset)
    return notification ? [notification] : []
  })
  if (data.length) await tx.notification.createMany({ data })
}

// Bulk rebuild future reminders under the same lock as booking/rescheduling.
// Preserve sent offsets to avoid re-sending a reminder after a settings change
export async function refreshReminders(tx: Database, organizationId: string) {
  await tx.notification.updateMany({ where: { organizationId, kind: "REMINDER", status: { in: ["PENDING", "SCHEDULED"] } }, data: { status: "CANCELLED" } })
  const settings = await tx.organizationSettings.findUnique({ where: { organizationId } })
  if (settings?.enableAppointmentReminders === false) return
  const appointments = await tx.appointment.findMany({ where: { organizationId, startsAt: { gt: new Date() }, status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] }, OR: [{ status: { not: "PENDING" } }, { expiresAt: null }, { expiresAt: { gt: new Date() } }] }, include: notificationInclude })
  const sent = await tx.notification.findMany({ where: { organizationId, kind: "REMINDER", status: "SENT" }, select: { appointmentId: true, metadata: true } })
  const data = appointments.flatMap((appointment) => (settings?.reminderOffsetsMinutes ?? [1440]).flatMap((offset) => {
    if (sent.some((notification) => notification.appointmentId === appointment.id && notification.metadata && typeof notification.metadata === "object" && !Array.isArray(notification.metadata) && notification.metadata.reminderOffsetMinutes === offset)) return []
    const notification = notificationData(appointment, "REMINDER", offset)
    return notification ? [notification] : []
  }))
  // Bound SQL batch sizes while retaining one atomic settings change
  for (let index = 0; index < data.length; index += 500) await tx.notification.createMany({ data: data.slice(index, index + 500) })
}

export async function cancelReminders(tx: Database, organizationId: string, appointmentId: string) {
  await tx.notification.updateMany({ where: { organizationId, appointmentId, kind: "REMINDER", status: { in: ["PENDING", "SCHEDULED"] } }, data: { status: "CANCELLED" } })
}

export async function cancelOutdatedNotifications(tx: Database, organizationId: string, appointmentId: string) {
  await tx.notification.updateMany({
    where: { organizationId, appointmentId, kind: { in: ["REMINDER", "BOOKING_CONFIRMATION", "RESCHEDULE"] }, status: { in: ["PENDING", "SCHEDULED"] } },
    data: { status: "CANCELLED" },
  })
}
