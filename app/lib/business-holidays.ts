import { Temporal } from "@js-temporal/polyfill"

export type BusinessHoliday = { id: string; name: string; date: string; enabled: boolean; closed: boolean; startMinute: number; endMinute: number }

export function readBusinessExceptions(value: unknown): BusinessHoliday[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return []
  const exceptions = (value as { exceptions?: unknown }).exceptions
  return Array.isArray(exceptions) ? exceptions : []
}

// Gregorian Easter (Meeus/Jones/Butcher), so movable holidays follow each year
export function defaultBusinessHolidays(year: number): BusinessHoliday[] {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const easter = Temporal.PlainDate.from({ year, month: Math.floor((h + l - 7 * m + 114) / 31), day: (h + l - 7 * m + 114) % 31 + 1 })
  const fixed = (month: number, day: number) => Temporal.PlainDate.from({ year, month, day }).toString()
  const saturdayFrom = (month: number, day: number) => {
    const start = Temporal.PlainDate.from({ year, month, day })
    return start.add({ days: (6 - start.dayOfWeek + 7) % 7 })
  }
  const midsummer = saturdayFrom(6, 20)
  const dates: [string, string][] = [
    ["newYear", fixed(1, 1)], ["epiphany", fixed(1, 6)],
    ["goodFriday", easter.subtract({ days: 2 }).toString()], ["easter", easter.toString()],
    ["easterMonday", easter.add({ days: 1 }).toString()], ["labourDay", fixed(5, 1)],
    ["ascension", easter.add({ days: 39 }).toString()], ["pentecost", easter.add({ days: 49 }).toString()],
    ["midsummerEve", midsummer.subtract({ days: 1 }).toString()], ["midsummer", midsummer.toString()],
    ["allSaints", saturdayFrom(10, 31).toString()], ["independence", fixed(12, 6)],
    ["christmasEve", fixed(12, 24)], ["christmas", fixed(12, 25)], ["boxingDay", fixed(12, 26)], ["newYearsEve", fixed(12, 31)],
  ]
  return dates.map(([id, date]) => ({ id, name: "", date, enabled: true, closed: true, startMinute: 540, endMinute: 1020 })).sort((a, b) => a.date.localeCompare(b.date))
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

function customHolidayInYear(holiday: BusinessHoliday, year: number) {
  try {
    return { ...holiday, date: Temporal.PlainDate.from(holiday.date).with({ year }, { overflow: "reject" }).toString() }
  } catch { return null }
}

export function holidaysForYear(value: unknown, year: number): BusinessHoliday[] {
  const settings = readHolidaySettings(value)
  return [
    ...defaultBusinessHolidays(year).map((holiday) => {
      const saved = settings.find((entry) => entry.id === holiday.id)
      return saved ? { ...holiday, enabled: saved.enabled, closed: saved.closed, startMinute: saved.startMinute, endMinute: saved.endMinute } : holiday
    }),
    ...settings.filter((entry) => entry.id.startsWith("custom-")).flatMap((holiday) => {
      const occurrence = customHolidayInYear(holiday, year)
      return occurrence ? [occurrence] : []
    }),
  ].sort((a, b) => a.date.localeCompare(b.date))
}

export function upcomingBusinessHolidays(value: unknown, today: string): BusinessHoliday[] {
  const year = Temporal.PlainDate.from(today).year
  const upcoming = new Map<string, BusinessHoliday>()
  // Eight years also covers February 29 across a non-leap century
  for (let offset = 0; offset <= 8; offset++) {
    for (const holiday of holidaysForYear(value, year + offset)) {
      if (holiday.date >= today && !upcoming.has(holiday.id)) upcoming.set(holiday.id, holiday)
    }
  }
  return [...upcoming.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function businessHolidayWindows(value: unknown, from: Date, to: Date, timezone: string) {
  const first = Temporal.Instant.fromEpochMilliseconds(+from).toZonedDateTimeISO(timezone).year
  const last = Temporal.Instant.fromEpochMilliseconds(+to).toZonedDateTimeISO(timezone).year
  const exceptions = readBusinessExceptions(value).filter((entry) => entry.enabled)
  const exceptionDates = new Set(exceptions.map((entry) => entry.date))
  const windows: { start: number; end: number; title: string; holidayId: string; isOpen: boolean }[] = []
  for (let year = first; year <= last; year++) {
    const days = [...holidaysForYear(value, year).filter((holiday) => !exceptionDates.has(holiday.date)), ...exceptions.filter((entry) => Temporal.PlainDate.from(entry.date).year === year)]
    for (const holiday of days) {
      if (!holiday.enabled) continue
      const date = Temporal.PlainDate.from(holiday.date)
      const at = (minute: number) => date.toPlainDateTime("00:00").add({ minutes: minute }).toZonedDateTime(timezone).epochMilliseconds
      const start = at(0)
      const end = at(1440)
      if (start >= +to || end <= +from) continue
      // A holiday replaces the whole day's hours, with closed intervals around custom hours
      if (holiday.closed) windows.push({ start, end, title: holiday.name, holidayId: holiday.id, isOpen: false })
      else {
        windows.push({ start: at(holiday.startMinute), end: at(holiday.endMinute), title: holiday.name, holidayId: holiday.id, isOpen: true })
        if (holiday.startMinute > 0) windows.push({ start, end: at(holiday.startMinute), title: holiday.name, holidayId: holiday.id, isOpen: false })
        if (holiday.endMinute < 1440) windows.push({ start: at(holiday.endMinute), end, title: holiday.name, holidayId: holiday.id, isOpen: false })
      }
    }
  }
  return windows
}
