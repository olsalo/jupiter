import { Temporal } from "@js-temporal/polyfill"

export type BusinessHoliday = { id: string; name: string; labels?: { en: string; fi: string }; date: string; endDate?: string; enabled: boolean; closed: boolean; startMinute: number; endMinute: number }

export function readBusinessExceptions(value: unknown): BusinessHoliday[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return []
  const exceptions = (value as { exceptions?: unknown }).exceptions
  return Array.isArray(exceptions) ? exceptions : []
}

export function readHolidaySettings(value: unknown): BusinessHoliday[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return []
  const settings = value as { holidays?: BusinessHoliday[] } & Record<string, unknown>
  if (Array.isArray(settings.holidays)) return settings.holidays
  // Preserve existing custom holidays and hour changes from the former yearly format
  const entries = Object.entries(settings).filter(([year, days]) => /^\d{4}$/.test(year) && Array.isArray(days)).sort(([a], [b]) => a.localeCompare(b))
  const holidays = new Map<string, BusinessHoliday>()
  for (const [, days] of entries) {
    for (const holiday of days as BusinessHoliday[]) holidays.set(holiday.id, { ...holiday, enabled: holiday.enabled ?? true })
  }
  return [...holidays.values()]
}

export function businessHolidayDates(holiday: BusinessHoliday, from: string, to: string): string[] {
  const start = holiday.date > from ? holiday.date : from
  const end = (holiday.endDate || holiday.date) < to ? (holiday.endDate || holiday.date) : to
  const dates: string[] = []
  for (let date = Temporal.PlainDate.from(start); date.toString() <= end; date = date.add({ days: 1 })) dates.push(date.toString())
  return dates
}

export function recurringHolidayRangesOverlap(a: BusinessHoliday, b: BusinessHoliday) {
  try {
    const datesFor = (holiday: BusinessHoliday) => {
      const limit = Temporal.PlainDate.from(holiday.date).add({ days: 365 }).toString()
      return businessHolidayDates(holiday, holiday.date, limit).map((date) => date.slice(5))
    }
    const dates = new Set(datesFor(a))
    return datesFor(b).some((date) => dates.has(date))
  } catch { return false }
}
