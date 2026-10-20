import { calendarMinDurationMinutes } from "./time-step.ts"

type Service = { id: string; durationMinutes: number; isActive: boolean }
type Usage = { serviceId: string; bookings: number }

export function getCalendarDraftService<T extends Service>(services: readonly T[], usage: readonly Usage[], length?: number) {
  const counts = new Map(usage.map((item) => [item.serviceId, item.bookings]))
  return services.filter((service) => service.isActive && service.durationMinutes >= calendarMinDurationMinutes && (length === undefined || service.durationMinutes === length))
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))[0]
}

export function getCalendarServiceSelectionLength({ length, defaultLength, preserveCustomLength, serviceDurations }: {
  length: number
  defaultLength: number
  preserveCustomLength: boolean
  serviceDurations: readonly number[]
}) {
  return preserveCustomLength && !serviceDurations.includes(length) ? length : Math.max(calendarMinDurationMinutes, defaultLength)
}
