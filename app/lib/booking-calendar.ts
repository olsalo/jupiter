import type { BookingResult } from "~/components/public-booking/booking-types"

export function downloadBookingCalendar(booking: BookingResult) {
  const escape = (value: string) =>
    value
      .replaceAll("\\", "\\\\")
      .replaceAll("\n", "\\n")
      .replaceAll(",", "\\,")
      .replaceAll(";", "\\;")
  const date = (value: Date | string) =>
    new Date(value)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z")
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Jupiter//Appointments//EN",
    "BEGIN:VEVENT",
    `UID:${booking.bookingCode}@jupiter`,
    `DTSTAMP:${date(new Date())}`,
    `DTSTART:${date(booking.startsAt)}`,
    `DTEND:${date(booking.endsAt)}`,
    `SUMMARY:${escape(booking.services.map((service) => service.name).join(", "))}`,
    ...(booking.location
      ? [
          `LOCATION:${escape([booking.location.name, booking.location.addressLine1, booking.location.city].filter(Boolean).join(", "))}`,
        ]
      : []),
    `STATUS:${booking.status === "PENDING" ? "TENTATIVE" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
  const url = URL.createObjectURL(
    new Blob([lines.join("\r\n") + "\r\n"], {
      type: "text/calendar;charset=utf-8",
    }),
  )
  const link = document.createElement("a")
  link.href = url
  link.download = "appointment.ics"
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

