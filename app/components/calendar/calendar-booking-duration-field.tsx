import type { ComponentProps } from "react"

import { BookingDurationField } from "~/components/calendar/booking-duration-field"
import { useCalendarBookingDurationLimit } from "~/components/calendar/use-calendar-booking-duration-limit"

// Availability updates only affect the length control, not the entire booking form
export function CalendarBookingDurationField({ availability, ...props }: Omit<ComponentProps<typeof BookingDurationField>, "maxLength"> & {
  availability: Parameters<typeof useCalendarBookingDurationLimit>[0]
}) {
  const maxLength = useCalendarBookingDurationLimit(availability)
  return <BookingDurationField {...props} maxLength={maxLength} />
}
