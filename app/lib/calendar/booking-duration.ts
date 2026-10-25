import { blocksAppointmentTime } from "../appointment-status.ts"

type Booking = {
  id: string
  startsAt: Date | string
  endsAt: Date | string
  status: string
  staffMember: { id: string } | null
  services?: { bufferBeforeMinutes?: number; bufferAfterMinutes?: number }[]
}

export function getCalendarBookingDurationLimit(bookings: Booking[], startsAt: Date, memberId: string, appointmentId?: string, buffers: { beforeMinutes?: number; afterMinutes?: number } = {}) {
  let limit = 1440
  for (const booking of bookings) {
    if (booking.id === appointmentId || booking.staffMember?.id !== memberId || !blocksAppointmentTime(booking.status)) continue
    const start = +new Date(booking.startsAt) - Math.max(0, ...(booking.services ?? []).map((service) => service.bufferBeforeMinutes ?? 0)) * 60000
    const end = +new Date(booking.endsAt) + Math.max(0, ...(booking.services ?? []).map((service) => service.bufferAfterMinutes ?? 0)) * 60000
    if (end <= +startsAt - (buffers.beforeMinutes ?? 0) * 60000) continue
    limit = Math.min(limit, Math.max(0, Math.floor((start - +startsAt) / 60000) - (buffers.afterMinutes ?? 0)))
  }
  return limit
}
