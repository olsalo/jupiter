import { Temporal } from "@js-temporal/polyfill"

export const minuteMs = 60000
export function localDate(instant: Date, timezone: string) {
  return Temporal.Instant.from(instant.toISOString()).toZonedDateTimeISO(timezone).toPlainDate().toString()
}

export function localWindows(from: Date, to: Date, timezone: string, weekday: number, startMinute: number, endMinute: number) {
  const windows: { start: number; end: number }[] = []
  let date = Temporal.PlainDate.from(localDate(from, timezone)).subtract({ days: 1 })
  const last = Temporal.PlainDate.from(localDate(to, timezone)).add({ days: 1 })
  while (Temporal.PlainDate.compare(date, last) <= 0) {
    if (date.dayOfWeek % 7 === weekday) {
      const midnight = date.toZonedDateTime(timezone)
      const nextMidnight = date.add({ days: 1 }).toZonedDateTime(timezone)
      const transition = midnight.getTimeZoneTransition("next")
      if (transition && transition.epochMilliseconds < nextMidnight.epochMilliseconds) {
        // On transition days, classify actual instants by their wall-clock
        // minute. This skips nonexistent minutes and includes both repeated
        // periods without admitting wall-clock time outside the working rule
        let window: { start: number; end: number } | undefined
        for (let instant = midnight.epochMilliseconds; instant < nextMidnight.epochMilliseconds; instant += minuteMs) {
          const local = Temporal.Instant.fromEpochMilliseconds(instant).toZonedDateTimeISO(timezone)
          const minute = local.hour * 60 + local.minute
          if (minute >= startMinute && minute < endMinute) {
            if (!window) { window = { start: instant, end: instant + minuteMs }
              windows.push(window) }
            else window.end = instant + minuteMs
          } else window = undefined
        }
      } else {
        const start = date.toPlainDateTime("00:00").add({ minutes: startMinute }).toZonedDateTime(timezone).epochMilliseconds
        const end = date.toPlainDateTime("00:00").add({ minutes: endMinute }).toZonedDateTime(timezone).epochMilliseconds
        if (end > start) windows.push({ start, end })
      }
    }
    date = date.add({ days: 1 })
  }
  return windows
}
