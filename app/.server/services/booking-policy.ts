import type { Appointment, OrganizationSettings, Service } from "../../../generated/prisma/client"

export function captureBookingPolicy(settings: OrganizationSettings | null, service: Service | null) {
  return {
    cancellationNoticeMinutes: service?.cancellationNoticeMinutes ?? settings?.cancellationNoticeMinutes ?? 0,
    rescheduleNoticeMinutes: service?.rescheduleNoticeMinutes ?? settings?.rescheduleNoticeMinutes ?? 0,
    minBookingNoticeMinutes: service?.minBookingNoticeMinutes ?? settings?.minBookingNoticeMinutes ?? 0,
    maxBookingAdvanceDays: service?.maxBookingAdvanceDays ?? settings?.maxBookingAdvanceDays ?? null,
    allowCustomerCancellation: settings?.allowCustomerCancellation ?? true,
    allowCustomerRescheduling: settings?.allowCustomerRescheduling ?? true,
  }
}

export function savedBookingPolicy(appointment: Appointment, settings: OrganizationSettings | null, service: Service | null) {
  const current = captureBookingPolicy(settings, service)
  return {
    cancellationNoticeMinutes: appointment.cancellationNoticeMinutes ?? current.cancellationNoticeMinutes,
    rescheduleNoticeMinutes: appointment.rescheduleNoticeMinutes ?? current.rescheduleNoticeMinutes,
    minBookingNoticeMinutes: appointment.minBookingNoticeMinutes ?? current.minBookingNoticeMinutes,
    // A captured null advance limit means unlimited, rather than inheriting a later limit
    maxBookingAdvanceDays: appointment.cancellationNoticeMinutes !== null ? appointment.maxBookingAdvanceDays : current.maxBookingAdvanceDays,
    allowCustomerCancellation: appointment.allowCustomerCancellation ?? current.allowCustomerCancellation,
    allowCustomerRescheduling: appointment.allowCustomerRescheduling ?? current.allowCustomerRescheduling,
  }
}
