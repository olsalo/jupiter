import { createHash } from "node:crypto"
import Holidays from "date-holidays"

import type { BusinessHoliday } from "./business-holidays.ts"

// Shared names retain existing saved preferences and translations across countries
const commonHolidayIds: Record<string, string> = {
  "01-01": "newYear",
  "01-06": "epiphany",
  "easter -2": "goodFriday",
  "orthodox -2": "goodFriday",
  easter: "easter",
  orthodox: "easter",
  "easter 1": "easterMonday",
  "orthodox 1": "easterMonday",
  "05-01": "labourDay",
  "easter 39": "ascension",
  "orthodox 39": "ascension",
  "easter 49": "pentecost",
  "orthodox 49": "pentecost",
  "friday after 06-19": "midsummerEve",
  "saturday after 06-20": "midsummer",
  "saturday after 10-31": "allSaints",
  "12-24": "christmasEve",
  "12-25": "christmas",
  "12-26": "boxingDay",
  "12-31": "newYearsEve",
  // Keep the existing stored ID; the country calendar still calculates the date
  "FI:12-06": "independence",
}

const cache = new Map<string, BusinessHoliday[]>()

export function nationalBusinessHolidays(year: number, countryCode: string): BusinessHoliday[] {
  const country = countryCode.toUpperCase()
  const cacheKey = `${country}:${year}`
  let holidays = cache.get(cacheKey)
  if (!holidays) {
    const calendar = new Holidays(country, { languages: ["en"], types: ["public", "bank"] })
    const english = calendar.getHolidays(year)
    calendar.setLanguages(["fi", "en"])
    const finnish = calendar.getHolidays(year)
    holidays = english.flatMap((holiday) => {
      // Partial bank holidays are not suggestions for a full business closure
      if (!holiday.date.endsWith("00:00:00")) return []
      const rule = holiday.rule.replace(/^substitutes /, "")
      const baseRule = rule.match(/^(?:\d{2}-\d{2}|(?:easter|orthodox)(?: -?\d+)?)/)?.[0] ?? rule
      // Some calendars publish a named movable holiday as individual yearly dates
      const recurringRule = /^\d{4}-\d{2}-\d{2}$/.test(rule) ? holiday.name : rule
      const hash = createHash("sha256").update(recurringRule).digest("hex").slice(0, 16)
      const id = `${commonHolidayIds[`${country}:${baseRule}`] ?? commonHolidayIds[baseRule] ?? `national-${country}-${hash}`}${holiday.substitute ? "-observed" : ""}`
      const translated = finnish.find((entry) => entry.rule === holiday.rule && entry.date === holiday.date)
      return [{
        id,
        name: "",
        labels: { en: holiday.name, fi: translated?.name ?? holiday.name },
        date: holiday.date.slice(0, 10),
        enabled: true,
        closed: true,
        startMinute: 540,
        endMinute: 1020,
      }]
    })
    if (cache.size >= 256) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(cacheKey, holidays)
  }
  return holidays.map((holiday) => ({ ...holiday, labels: holiday.labels ? { ...holiday.labels } : undefined }))
}
