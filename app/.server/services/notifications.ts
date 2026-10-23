import { fallbackLanguage } from "~/locales"
import { isSupportedLocale } from "~/lib/locale"
import { createAppointmentEmailTemplate, type AppointmentEmailKind } from "~/lib/email-templates/appointment"
import { queuedEmailContent } from "./email-queue"
import type { Prisma } from "../../../generated/prisma/client"
import type { Database } from "./scheduling"

const notificationInclude = { customer: true, organization: { include: { settings: true } }, services: true } as const
type NotificationAppointment = Prisma.AppointmentGetPayload<{ include: typeof notificationInclude }>

async function notificationData(appointment: NotificationAppointment, kind: AppointmentEmailKind, offsetMinutes?: number): Promise<Prisma.NotificationCreateManyInput | null> {
  if (!appointment.customer.email) return null
  const settings = appointment.organization.settings
  if ((kind === "BOOKING_CONFIRMATION" && settings?.sendBookingConfirmations === false) || (kind === "CANCELLATION" && settings?.sendCancellationEmails === false) || (kind === "RESCHEDULE" && settings?.sendRescheduleEmails === false) || (kind === "REMINDER" && settings?.enableAppointmentReminders === false)) return null
  const locale = isSupportedLocale(appointment.customer.locale) ? appointment.customer.locale : fallbackLanguage
  const scheduledAt = kind === "REMINDER" ? new Date(+appointment.startsAt - offsetMinutes! * 60000) : new Date()
  if (kind === "REMINDER" && scheduledAt <= new Date()) return null
  const managementUrl = process.env.BETTER_AUTH_URL
    ? new URL(`/booking/${appointment.bookingCode}`, process.env.BETTER_AUTH_URL).toString()
    : undefined
  const rescheduleUrl = managementUrl && (appointment.allowCustomerRescheduling ?? settings?.allowCustomerRescheduling ?? true) && ["PENDING", "CONFIRMED"].includes(appointment.status)
    ? `${managementUrl}/reschedule`
    : undefined
  const template = await createAppointmentEmailTemplate({ kind, locale, organizationName: appointment.organization.name, services: appointment.services.map((service) => service.name), startsAt: appointment.startsAt, timezone: appointment.timezone, country: settings?.countryCode ?? "FI", bookingCode: appointment.bookingCode, rescheduleUrl, managementUrl })
  return { organizationId: appointment.organizationId, appointmentId: appointment.id, kind, channel: "EMAIL", status: kind === "REMINDER" ? "SCHEDULED" : "PENDING", recipient: appointment.customer.email, scheduledAt, ...queuedEmailContent(template, locale, kind === "REMINDER" ? { reminderOffsetMinutes: offsetMinutes! } : {}) }
}

export async function queueNotification(tx: Database, organizationId: string, appointmentId: string, kind: AppointmentEmailKind) {
  const appointment = await tx.appointment.findFirst({ where: { id: appointmentId, organizationId }, include: notificationInclude })
  if (!appointment) return
  const offsets = kind === "REMINDER" ? appointment.organization.settings?.reminderOffsetsMinutes ?? [1440] : [undefined]
  const data = (await Promise.all(offsets.map((offset) => notificationData(appointment, kind, offset)))).filter((notification) => notification !== null)
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
  const data: Prisma.NotificationCreateManyInput[] = []
  for (const appointment of appointments) {
    for (const offset of settings?.reminderOffsetsMinutes ?? [1440]) {
      if (sent.some((notification) => notification.appointmentId === appointment.id && notification.metadata && typeof notification.metadata === "object" && !Array.isArray(notification.metadata) && notification.metadata.reminderOffsetMinutes === offset)) continue
      const notification = await notificationData(appointment, "REMINDER", offset)
      if (notification) data.push(notification)
    }
  }
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
