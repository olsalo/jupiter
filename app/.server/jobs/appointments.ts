import { randomUUID } from "node:crypto"
import type { PrismaClient } from "../../../generated/prisma/client"
import { sendEmail } from "~/lib/email.server"
import { cancelOutdatedNotifications } from "../services/notifications"
import { schedulingLock } from "../services/scheduling"

export async function sendPendingNotifications(db: PrismaClient, options: { now?: Date; limit?: number; send?: typeof sendEmail } = {}) {
  const now = options.now ?? new Date()
  const send = options.send ?? sendEmail
  const candidates = await db.notification.findMany({ where: { channel: "EMAIL", status: { in: ["PENDING", "SCHEDULED"] }, OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }] }, orderBy: [{ scheduledAt: "asc" }, { id: "asc" }], take: Math.min(100, Math.max(1, options.limit ?? 100)) })
  let sent = 0
  let failed = 0
  for (const candidate of candidates) {
    const metadata = candidate.metadata && typeof candidate.metadata === "object" && !Array.isArray(candidate.metadata) ? candidate.metadata : {}
    const attempts = typeof metadata.attempts === "number" ? metadata.attempts + 1 : 1
    const leaseToken = randomUUID()
    const leaseUntil = new Date(+now + 5 * 60000)
    const claim = await db.notification.updateMany({ where: { id: candidate.id, organizationId: candidate.organizationId, status: candidate.status, scheduledAt: candidate.scheduledAt, updatedAt: candidate.updatedAt }, data: { status: "SCHEDULED", scheduledAt: leaseUntil, metadata: { ...metadata, attempts, leaseToken } } })
    if (!claim.count) continue
    const where = { id: candidate.id, organizationId: candidate.organizationId, status: "SCHEDULED" as const, scheduledAt: leaseUntil, metadata: { path: ["leaseToken"], equals: leaseToken } }
    try {
      const settings = await db.organizationSettings.findUnique({ where: { organizationId: candidate.organizationId } })
      const invitationId = typeof metadata.invitationId === "string" ? metadata.invitationId : null
      if (invitationId && !await db.invitation.findFirst({ where: { id: invitationId, organizationId: candidate.organizationId, status: "pending", expiresAt: { gt: new Date() } } })) {
        await db.notification.updateMany({ where, data: { status: "CANCELLED" } })
        continue
      }
      const disabled = (candidate.kind === "REMINDER" && settings?.enableAppointmentReminders === false)
        || (candidate.kind === "BOOKING_CONFIRMATION" && settings?.sendBookingConfirmations === false)
        || (candidate.kind === "CANCELLATION" && settings?.sendCancellationEmails === false)
        || (candidate.kind === "RESCHEDULE" && settings?.sendRescheduleEmails === false)
      if (disabled) {
        await db.notification.updateMany({ where, data: { status: "CANCELLED" } })
        continue
      }
      if (!options.send && (!process.env.EMAIL_PROVIDER || !(process.env.EMAIL_PROVIDER === "resend" ? process.env.RESEND_API_KEY : process.env.PLUNK_API_KEY))) throw new Error("Email delivery is not configured")
      const escaped = candidate.body.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!)
      await send({ senderName: settings?.senderName ?? undefined, replyTo: settings?.replyToAddress ?? undefined, to: candidate.recipient, subject: candidate.subject ?? "Appointment update", text: candidate.body, html: invitationId && typeof metadata.invitationHtml === "string" ? metadata.invitationHtml : `<div style="white-space:pre-wrap">${escaped}</div>` })
      const result = await db.notification.updateMany({ where, data: { status: "SENT", sentAt: new Date(), errorMessage: null, failedAt: null } })
      sent += result.count
    } catch {
      // Store a generic error: provider errors can contain recipient details
      await db.notification.updateMany({ where, data: { status: attempts >= 5 ? "FAILED" : "SCHEDULED", failedAt: new Date(), errorMessage: "Email delivery failed", scheduledAt: new Date(+now + Math.min(60, 2 ** attempts) * 60000) } })
      failed++
    }
  }
  return { sent, failed }
}

export async function expirePendingAppointments(db: PrismaClient, now = new Date(), organizationId?: string) {
  const candidates = await db.appointment.findMany({ where: { organizationId, status: "PENDING", expiresAt: { lte: now } }, select: { id: true, organizationId: true }, take: 100 })
  let cancelled = 0
  for (const appointment of candidates) {
    cancelled += await db.$transaction(async (tx) => {
      await schedulingLock(tx, appointment.organizationId)
      const result = await tx.appointment.updateMany({ where: { id: appointment.id, organizationId: appointment.organizationId, status: "PENDING", expiresAt: { lte: now } }, data: { status: "CANCELLED", cancelledAt: now, cancellationReason: "Booking hold expired" } })
      if (result.count) {
        await tx.appointmentEvent.create({ data: { organizationId: appointment.organizationId, appointmentId: appointment.id, type: "CANCELLED", message: "Booking hold expired" } })
        await cancelOutdatedNotifications(tx, appointment.organizationId, appointment.id)
      }
      return result.count
    })
  }
  return { cancelled }
}

export async function pruneBookingRateLimits(db: PrismaClient, now = new Date()) {
  return db.auditLog.deleteMany({ where: { entityType: "booking-request", action: { in: ["booking.request.read", "booking.request.write"] }, createdAt: { lt: new Date(+now - 86400000) } } })
}
