import { subtractAvailabilityWindows } from "../booking/availability-windows.ts"
import { Temporal } from "@js-temporal/polyfill"
import { localizationDefaults } from "../localization/defaults.ts"
import { businessHolidayDates, readBusinessExceptions, readHolidaySettings, type BusinessHoliday } from "./business-holidays.ts"
import { nationalBusinessHolidays } from "./national-holidays.server.ts"

export function defaultBusinessHolidays(year: number, countryCode: string = localizationDefaults.location): BusinessHoliday[] {
  return nationalBusinessHolidays(year, countryCode)
}

function customHolidayInYear(holiday: BusinessHoliday, year: number) {
  try {
    const original = Temporal.PlainDate.from(holiday.date)
    const date = original.with({ year }, { overflow: "reject" }).toString()
    const endDate = holiday.endDate ? Temporal.PlainDate.from(holiday.endDate).with({ year: year + Temporal.PlainDate.from(holiday.endDate).year - original.year }, { overflow: "reject" }).toString() : holiday.endDate
    return { ...holiday, date, endDate }
  } catch { return null }
}

export function holidaysForYear(value: unknown, year: number, countryCode: string = localizationDefaults.location): BusinessHoliday[] {
  const settings = readHolidaySettings(value)
  return [
    ...defaultBusinessHolidays(year, countryCode).map((holiday) => {
      const saved = settings.find((entry) => entry.id === holiday.id)
      return saved ? { ...holiday, enabled: saved.enabled, closed: saved.closed, startMinute: saved.startMinute, endMinute: saved.endMinute } : holiday
    }),
    ...settings.filter((entry) => entry.id.startsWith("custom-")).flatMap((holiday) => {
      const occurrence = customHolidayInYear(holiday, year)
      return occurrence ? [occurrence] : []
    }),
  ].sort((a, b) => a.date.localeCompare(b.date))
}

export function upcomingBusinessHolidays(value: unknown, today: string, countryCode: string = localizationDefaults.location): BusinessHoliday[] {
  const year = Temporal.PlainDate.from(today).year
  const upcoming = new Map<string, BusinessHoliday>()
  // Eight years also covers February 29 across a non-leap century
  for (let offset = -1; offset <= 8; offset++) {
    for (const holiday of holidaysForYear(value, year + offset, countryCode)) {
      if ((holiday.endDate || holiday.date) >= today && !upcoming.has(holiday.id)) upcoming.set(holiday.id, holiday)
    }
  }
  return [...upcoming.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function businessHolidayWindows(value: unknown, from: Date, to: Date, timezone: string, countryCode: string = localizationDefaults.location) {
  const first = Temporal.Instant.fromEpochMilliseconds(+from).toZonedDateTimeISO(timezone).year
  const last = Temporal.Instant.fromEpochMilliseconds(+to).toZonedDateTimeISO(timezone).year
  const exceptions = readBusinessExceptions(value).filter((entry) => entry.enabled)
  const fromDate = Temporal.Instant.fromEpochMilliseconds(+from).toZonedDateTimeISO(timezone).toPlainDate().toString()
  const toDate = Temporal.Instant.fromEpochMilliseconds(+to).toZonedDateTimeISO(timezone).toPlainDate().toString()
  const exceptionDates = new Map<string, BusinessHoliday[]>()
  for (const entry of exceptions) {
    for (const date of businessHolidayDates(entry, fromDate, toDate)) {
      exceptionDates.set(date, [...(exceptionDates.get(date) ?? []), { ...entry, date }])
    }
  }
  const windows: { start: number; end: number; title: string; labels?: BusinessHoliday["labels"]; holidayId: string; isOpen: boolean }[] = []
  const days = new Map<string, BusinessHoliday>()
  const customDays = new Map<string, BusinessHoliday>()
  for (let year = first - 1; year <= last; year++) {
    for (const holiday of holidaysForYear(value, year, countryCode)) {
      if (!holiday.enabled) continue
      for (const date of businessHolidayDates(holiday, fromDate, toDate)) (holiday.id.startsWith("custom-") ? customDays : days).set(date, { ...holiday, date })
    }
  }
  for (const [date, entry] of customDays) days.set(date, entry)
  for (const date of exceptionDates.keys()) days.delete(date)
  const groups = [...Array.from(days.values(), (holiday) => [holiday]), ...exceptionDates.values()]
  for (const entries of groups) {
    // All-day closures win; otherwise keep every opening and block only their combined gaps.
    const holiday = entries.find((entry) => entry.closed) ?? entries[0]
    const date = Temporal.PlainDate.from(holiday.date)
    const at = (minute: number) => date.toPlainDateTime("00:00").add({ minutes: minute }).toZonedDateTime(timezone).epochMilliseconds
    const start = at(0)
    const end = at(1440)
    if (start >= +to || end <= +from) continue
    // A holiday replaces the whole day's hours, with closed intervals around custom hours
    if (holiday.closed) windows.push({ start, end, title: holiday.name, labels: holiday.labels, holidayId: holiday.id, isOpen: false })
    else {
      const openings = entries.map((entry) => ({ start: at(entry.startMinute), end: at(entry.endMinute), title: entry.name, labels: entry.labels, holidayId: entry.id, isOpen: true }))
      windows.push(...openings)
      windows.push(...subtractAvailabilityWindows([{ start, end, title: holiday.name, labels: holiday.labels, holidayId: holiday.id, isOpen: false }], openings))
    }
  }
  return windows
}
