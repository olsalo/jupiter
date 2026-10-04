import { TZDate } from "react-day-picker"

export function closingDateToTime(day: string, timeZone: string) {
  const [year, month, date] = day.split("-").map(Number)
  // Availability closes at midnight after the selected day, including DST changes.
  return new Date(new TZDate(year, month - 1, date + 1, timeZone).getTime())
}

export function closingTimeToDate(closesAt: Date | null, timeZone: string) {
  if (!closesAt) return null
  const date = new TZDate(closesAt.getTime() - 1, timeZone)
  return calendarDateToValue(date)
}

export function calendarDateToValue(date: Date) {
  return `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`
}

export function calendarDateFromValue(day: string, timeZone: string) {
  const [year, month, date] = day.split("-").map(Number)
  return new TZDate(year, month - 1, date, timeZone)
}
