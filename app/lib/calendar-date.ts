import { TZDate } from "react-day-picker"

export function calendarDateToValue(date: Date) {
  return `${date.getFullYear().toString().padStart(4, "0")}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`
}

export function calendarDateFromValue(day: string, timeZone: string) {
  const [year, month, date] = day.split("-").map(Number)
  return new TZDate(year, month - 1, date, timeZone)
}
