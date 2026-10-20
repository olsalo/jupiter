import { calendarIntervalMinutes } from "./time-step.ts"
import { TZDate } from "react-day-picker"

export function calendarDateToValue(date: Date) {
  return `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`
}

export function calendarDateFromValue(day: string, timeZone: string) {
  const [year, month, date] = day.split("-").map(Number)
  return new TZDate(year, month - 1, date, timeZone)
}

export function getCalendarDateState(searchParams: URLSearchParams, { timeZone, weekStartsOn = 1, defaultCalendarView = "week", now = Date.now() }: {
  timeZone: string
  now?: number
  weekStartsOn?: number
  defaultCalendarView?: string
}) {
  const value = searchParams.get("date")
  const parsed = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? calendarDateFromValue(value, timeZone) : undefined
  const selected = parsed && !Number.isNaN(parsed.getTime()) && calendarDateToValue(parsed) === value ? parsed : new TZDate(now, timeZone)
  const view = searchParams.get("view") ?? defaultCalendarView
  const mode = view === "day" || view === "list" ? view : "week"
  const firstDay = weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6
  const weekStart = calendarDateFromValue(calendarDateToValue(selected), timeZone)
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() - firstDay + 7) % 7)
  const weekEnd = calendarDateFromValue(calendarDateToValue(weekStart), timeZone)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const rangeEnd = calendarDateFromValue(calendarDateToValue(weekStart), timeZone)
  rangeEnd.setDate(rangeEnd.getDate() + 7)
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = calendarDateFromValue(calendarDateToValue(weekStart), timeZone)
    date.setDate(date.getDate() + index)
    return date
  })
  return { selected, mode, weekStart, weekEnd, weekStartsOn: firstDay, days, range: { from: new Date(+weekStart), to: new Date(+rangeEnd) } }
}

export function getCalendarBookingRange(state: Pick<ReturnType<typeof getCalendarDateState>, "mode" | "selected" | "range">, timeZone: string) {
  if (state.mode !== "day") return state.range
  const from = calendarDateFromValue(calendarDateToValue(state.selected), timeZone)
  const to = calendarDateFromValue(calendarDateToValue(state.selected), timeZone)
  to.setDate(to.getDate() + 1)
  return { from: new Date(+from), to: new Date(+to) }
}

export function getCalendarTimeRange(day: string, startMinute: number, durationMinutes: number, timeZone: string) {
  const localStart = calendarDateFromValue(day, timeZone)
  localStart.setHours(Math.floor(startMinute / 60), startMinute % 60, 0, 0)
  const startsAt = new Date(+localStart)
  return { startsAt, endsAt: new Date(+startsAt + durationMinutes * 60000) }
}

export function getCalendarEarliestBookingMinute(day: string, timeZone: string, now = Date.now(), intervalMinutes = calendarIntervalMinutes) {
  const local = new TZDate(now, timeZone)
  const today = calendarDateToValue(local)
  if (day < today) return 1440
  if (day > today) return 0
  return Math.min(1440, (Math.floor((local.getHours() * 60 + local.getMinutes()) / intervalMinutes) + 1) * intervalMinutes)
}
