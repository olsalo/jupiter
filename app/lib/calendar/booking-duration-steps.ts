import { calendarIntervalMinutes, calendarMinDurationMinutes } from "./time-step.ts"

type DurationOptions = {
  maxDuration: number
  serviceDurations?: readonly number[]
  intervalMinutes?: number
  minDurationMinutes?: number
}

export function getCalendarBookingDurationStops({ maxDuration, serviceDurations, intervalMinutes = calendarIntervalMinutes, minDurationMinutes = calendarMinDurationMinutes }: DurationOptions) {
  const maximum = Math.min(1440, maxDuration)
  if (maximum < minDurationMinutes) return []
  const services = serviceDurations?.filter((duration) => Number.isInteger(duration) && duration >= minDurationMinutes && duration <= 1440) ?? []
  const durations = new Set([minDurationMinutes])
  for (const duration of services) durations.add(duration)
  const longest = Math.max(minDurationMinutes, ...services)
  for (let duration = longest + intervalMinutes; duration <= maximum; duration += intervalMinutes) durations.add(duration)
  return [...durations].filter((duration) => duration <= maximum).sort((a, b) => a - b)
}

export function getCalendarBookingDurationStep({ length, direction, ...options }: DurationOptions & { length: number | null; direction: -1 | 1 }) {
  const stops = getCalendarBookingDurationStops(options)
  if (!stops.length) return length
  if (length === null) return stops[0]
  // The available gap boundary is also reachable from the duration controls
  const maximum = Math.min(1440, options.maxDuration)
  if (!stops.includes(maximum)) stops.push(maximum)
  return direction === 1 ? stops.find((duration) => duration > length) ?? stops.at(-1)!
    : [...stops].reverse().find((duration) => duration < length) ?? stops[0]
}

export function getCalendarBookingDragDuration({ requestedDuration, serviceDurationMinutes, ...options }: DurationOptions & {
  requestedDuration: number
  serviceDurationMinutes?: number
}) {
  const stops = getCalendarBookingDurationStops(options)
  if (!stops.length) return null
  // Keep exact gap boundaries and the current booking length available as extra stops
  const maximum = Math.min(1440, options.maxDuration)
  stops.push(maximum)
  if (serviceDurationMinutes !== undefined && serviceDurationMinutes >= (options.minDurationMinutes ?? calendarMinDurationMinutes) && serviceDurationMinutes <= maximum) stops.push(serviceDurationMinutes)
  return stops.sort((a, b) => Math.abs(a - requestedDuration) - Math.abs(b - requestedDuration) || b - a)[0]
}
