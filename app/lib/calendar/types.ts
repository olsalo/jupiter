import type { BookingAvailabilityIssue } from "./booking-issues"

export type CalendarMember = { id: string; name: string; image?: string | null }
export type CalendarUnavailableDay = { day: string; memberId: string }
export type CalendarUnavailableTime = CalendarUnavailableDay & { startMinute: number; endMinute: number; isBlocked?: boolean; title?: string }

export type CalendarAppointment = {
  id: string
  day: string
  memberId: string
  locationId?: string | null
  customerName: string
  startMinute: number
  endMinute: number
  availabilityIssues?: BookingAvailabilityIssue[]
  movable?: boolean
  durationMinutes?: number
  bufferBeforeMinutes?: number
  bufferAfterMinutes?: number
  service: { id: string; name: string; color: string }
  status?: string
  column?: number
  columns?: number
  draft?: boolean
  creationDraft?: boolean
}

export type CalendarDragSelection = { day: string; member: CalendarMember; startMinute: number; endMinute: number }

export type CalendarBookingPreview = {
  bufferBeforeMinutes?: number
  bufferAfterMinutes?: number
  locationId?: string | null
  preserveScroll?: boolean
  appointmentId?: string
  customerName?: string
  status?: string
  startsAt: string
  endsAt: string
  member: { id: string; name: string }
  service: { id: string; name: string; color: string }
}

export type CalendarBookingReturnMotion = {
  appointmentId: string
  bounds: { left: number; top: number; width: number; height: number }
}

export type CalendarBookingDragUpdate = { selection: CalendarDragSelection; appointmentId?: string }
