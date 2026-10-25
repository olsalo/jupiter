import assert from "node:assert/strict"

import { formatDateTime } from "../app/lib/localization/format-preference.ts"

const value = "2026-10-19T09:30:00Z"
const base = { formatPreference: "eu", language: "fi", timeZone: "Europe/Helsinki" } as const
assert.equal(formatDateTime(value, base), "19.10.2026 klo 12:30")
assert.equal(formatDateTime(value, { ...base, includeDate: false }), "12:30")
assert.equal(formatDateTime(value, { ...base, includeTime: false, includeYear: false }), "19.10.")
assert.equal(formatDateTime(value, { ...base, includeTime: false, includeWeekday: true, language: "en" }), "Monday 19.10.2026")
assert.equal(formatDateTime(value, { ...base, formatPreference: "us", includeDate: false }), "12:30 PM")
assert.equal(formatDateTime(value, { ...base, timeZone: "America/New_York", includeDate: false }), "5:30")
assert.equal(formatDateTime("2026-10-18T22:30:00Z", { ...base, includeTime: false }), "19.10.2026")
assert.equal(formatDateTime("2026-10-18T22:30:00Z", { ...base, timeZone: "UTC", includeTime: false }), "18.10.2026")
assert.equal(formatDateTime("invalid", base), "-")
for (let index = 0; index < 100; index += 1) {
  assert.equal(formatDateTime(value, { ...base, includeDate: false }), "12:30", "Reusing formatters preserves the timezone and clock format")
  assert.equal(formatDateTime(value, { ...base, timeZone: "UTC", includeDate: false, formatPreference: "us" }), "9:30 AM", "Alternating preferences and timezones does not reuse the wrong formatter")
}

console.info("PASS shared date/time formatting, preferences, languages, midnight boundaries and repeated formatter reuse")
