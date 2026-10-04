import { TZDate } from "react-day-picker"

export function getGreetingPeriod(now: Date, timeZone: string) {
  const hour = new TZDate(now.getTime(), timeZone).getHours()
  if (hour < 12) return "morning"
  if (hour < 17) return "afternoon"
  return "evening"
}

export function getStartOfWeek(now: Date, timeZone: string) {
  const date = new TZDate(now.getTime(), timeZone)
  date.setDate(date.getDate() - (date.getDay() + 6) % 7)
  date.setHours(0, 0, 0, 0)
  return new Date(date.getTime())
}

type OverviewRangeOptions = {
  days?: number
  endDate?: string
}

export function getOverviewDays(now: Date, timeZone: string, { days = 30, endDate }: OverviewRangeOptions = {}) {
  const today = new TZDate(now.getTime(), timeZone)
  if (endDate) {
    const [year, month, day] = endDate.split("-").map(Number)
    today.setFullYear(year, month - 1, day)
  }
  today.setHours(0, 0, 0, 0)

  return Array.from({ length: days }, (_, index) => {
    const date = new TZDate(today.getTime(), timeZone)
    date.setDate(date.getDate() - days + 1 + index)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    return { key, date: new Date(date.getTime()).toISOString(), value: 0 }
  })
}

export function getOverviewRange(now: Date, timeZone: string, options?: OverviewRangeOptions) {
  const days = getOverviewDays(now, timeZone, options)
  const end = new TZDate(new Date(days[days.length - 1].date).getTime(), timeZone)
  end.setDate(end.getDate() + 1)
  return { days, start: new Date(days[0].date), end: new Date(end.getTime()) }
}
