type Booking = {
  id: string
  startsAt: Date | string
  endsAt: Date | string
  status: string
  staffMember: { id: string } | null
}

export function getCalendarBookingDurationLimit(bookings: Booking[], startsAt: Date, memberId: string, appointmentId?: string) {
  let limit = 1440
  for (const booking of bookings) {
    if (booking.id === appointmentId || booking.staffMember?.id !== memberId || !["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"].includes(booking.status)) continue
    if (+new Date(booking.endsAt) <= +startsAt) continue
    limit = Math.min(limit, Math.max(0, Math.floor((+new Date(booking.startsAt) - +startsAt) / 60000)))
  }
  return limit
}
