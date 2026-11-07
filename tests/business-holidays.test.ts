import assert from "node:assert/strict"
import { createServer } from "vite"

const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/business-holidays",
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
})

try {
  const { defaultBusinessHolidays, upcomingBusinessHolidays, holidaysForYear, businessHolidayWindows } = await vite.ssrLoadModule("/app/lib/business/business-holidays.server.ts") as typeof import("../app/lib/business/business-holidays.server")
  const { onboardingCountryCodes } = await vite.ssrLoadModule("/app/lib/localization/countries.ts") as typeof import("../app/lib/localization/countries")
  const { businessExceptionSchema, businessHolidaySchema, createBusinessScheduleSchema } = await vite.ssrLoadModule("/app/lib/schemas/business-schedule.ts") as typeof import("../app/lib/schemas/business-schedule")

  for (const country of onboardingCountryCodes) {
    const holidays = defaultBusinessHolidays(2027, country)
    assert.ok(holidays.length > 0, `${country} has national holiday suggestions`)
    assert.equal(new Set(holidays.map(({ id }) => id)).size, holidays.length, `${country} has stable unique holiday IDs`)
    assert.equal(createBusinessScheduleSchema(holidays).safeParse({ workingHours: [], breaks: [], holidays }).success, true, `${country} suggestions are valid form values`)
    assert.deepEqual(defaultBusinessHolidays(2027, country.toUpperCase()), holidays)
  }

  const { nationalBusinessHolidays } = await vite.ssrLoadModule("/app/lib/business/national-holidays.server.ts") as typeof import("../app/lib/business/national-holidays.server")
  const fi = defaultBusinessHolidays(2027, "fi")
  assert.deepEqual(fi, nationalBusinessHolidays(2027, "fi"), "Finland uses the same country calendar provider")
  const legacy = holidaysForYear({ holidays: [{ ...fi.find(({ id }) => id === "independence")!, enabled: false, closed: false, startMinute: 600, endMinute: 720 }] }, 2028, "fi")
  assert.equal(legacy.find(({ id }) => id === "independence")?.enabled, false, "Existing saved Finnish holiday choices survive the provider change")
  assert.equal(legacy.find(({ id }) => id === "independence")?.startMinute, 600)
  const us = defaultBusinessHolidays(2027, "us")
  assert.equal(fi.find(({ id }) => id === "independence")?.date, "2027-12-06")
  assert.equal(fi.find(({ id }) => id === "easter")?.date, "2027-03-28")
  assert.equal(defaultBusinessHolidays(2027, "gr").find(({ id }) => id === "easter")?.date, "2027-05-02")
  assert.ok(us.some((holiday) => holiday.date === "2027-07-04" && holiday.labels?.en === "Independence Day"))
  assert.ok(us.some((holiday) => holiday.date === "2027-11-25" && holiday.labels?.en === "Thanksgiving Day"))
  assert.equal(us.some(({ id }) => ["independence", "midsummer", "midsummerEve"].includes(id)), false)
  assert.equal(us.find(({ id }) => id === "christmas-observed")?.date, "2027-12-24")
  assert.equal(us.find(({ id }) => id === "christmas")?.date, "2027-12-25")
  assert.ok(defaultBusinessHolidays(2027, "se").some((holiday) => holiday.date === "2027-06-06" && holiday.labels?.en === "National Day"))

  const custom = { id: "custom-summer", name: "Summer break", date: "2026-07-10", enabled: true, closed: true, startMinute: 540, endMinute: 1020 }
  const saved = { holidays: [...fi.map((holiday) => ({ ...holiday, enabled: holiday.id !== "christmas" })), custom] }
  const changedCountry = holidaysForYear(saved, 2028, "us")
  assert.equal(changedCountry.find(({ id }) => id === "christmas")?.enabled, false, "Shared holiday preferences survive country changes")
  assert.equal(changedCountry.find(({ id }) => id === custom.id)?.date, "2028-07-10", "Custom closures survive country changes")
  assert.equal(changedCountry.some(({ id }) => id === "independence"), false, "Previous country's national days are removed")

  const upcoming = upcomingBusinessHolidays(null, "2026-11-01", "us")
  assert.ok(upcoming.some((holiday) => holiday.date === "2026-11-26" && holiday.labels?.en === "Thanksgiving Day"))
  const schema = createBusinessScheduleSchema(upcoming)
  assert.equal(schema.safeParse({ workingHours: [], breaks: [], holidays: upcoming }).success, true)
  assert.equal(schema.safeParse({ workingHours: [], breaks: [], holidays: upcoming.slice(1) }).success, false, "Suggested holidays cannot be removed")
  assert.equal(schema.safeParse({ workingHours: [], breaks: [], holidays: [...upcoming, fi.find(({ id }) => id === "independence")] }).success, false, "Foreign national holidays cannot be submitted as defaults")

  const from = new Date("2027-07-04T00:00:00Z")
  const to = new Date("2027-07-05T00:00:00Z")
  assert.ok(businessHolidayWindows(null, from, to, "UTC", "us").length > 0, "US Independence Day closes availability")
  assert.equal(businessHolidayWindows(null, from, to, "UTC", "fi").length, 0, "US Independence Day does not close a Finnish business")

  const range = { ...custom, endDate: "2026-07-12" }
  const recurring = holidaysForYear({ holidays: [range] }, 2027, "fi").find(({ id }) => id === custom.id)!
  assert.equal(recurring.endDate, "2027-07-12")
  assert.equal(businessHolidayWindows({ holidays: [range] }, new Date("2027-07-09T00:00Z"), new Date("2027-07-14T00:00Z"), "UTC", "fi").filter(({ holidayId }) => holidayId === range.id).length, 3, "Both endpoints of yearly ranges close availability")
  const winter = { ...custom, date: "2026-12-30", endDate: "2027-01-02" }
  const winterWindows = businessHolidayWindows({ holidays: [winter] }, new Date("2028-01-01T00:00Z"), new Date("2028-01-03T00:00Z"), "UTC", "fi")
  assert.equal(winterWindows.filter(({ holidayId }) => holidayId === winter.id).length, 2, "Yearly ranges continue into the next year")
  assert.equal(upcomingBusinessHolidays({ holidays: [winter] }, "2027-01-01", "fi").find(({ id }) => id === winter.id)?.date, "2026-12-30", "Ongoing yearly ranges remain editable")
  const exception = { ...range, id: "exception-summer", date: "2027-07-11", endDate: "2027-07-12", closed: false, startMinute: 600, endMinute: 720 }
  const overridden = businessHolidayWindows({ holidays: [range], exceptions: [exception] }, new Date("2027-07-10T00:00Z"), new Date("2027-07-13T00:00Z"), "UTC", "fi")
  assert.equal(overridden.filter(({ holidayId }) => holidayId === range.id).length, 1, "One-off ranges override yearly hours for every selected date")
  assert.equal(overridden.filter(({ holidayId, isOpen }) => holidayId === exception.id && isOpen).length, 2)
  assert.equal(businessHolidayWindows({ exceptions: [exception] }, new Date("2028-07-10T00:00Z"), new Date("2028-07-13T00:00Z"), "UTC", "fi").length, 0, "One-off ranges do not repeat")
  const dst = { ...exception, closed: true, date: "2027-03-27", endDate: "2027-03-29" }
  const dstWindows = businessHolidayWindows({ exceptions: [dst] }, new Date("2027-03-26T22:00Z"), new Date("2027-03-29T21:00Z"), "Europe/Helsinki", "fi")
  assert.equal(dstWindows.filter(({ holidayId }) => holidayId === dst.id).length, 3)
  assert.equal(dstWindows.reduce((sum, window) => sum + window.end - window.start, 0), 71 * 60 * 60 * 1000, "Date ranges follow local calendar days across daylight saving")
  assert.equal(businessExceptionSchema.safeParse({ ...exception, endDate: "2027-07-10" }).success, false)
  assert.equal(businessExceptionSchema.safeParse({ ...exception, endDate: "invalid" }).success, false)
  assert.equal(businessHolidaySchema.safeParse({ ...range, endDate: "2030-07-10" }).success, false)
  const overlap = createBusinessScheduleSchema([]).safeParse({ workingHours: [], breaks: [], holidays: [range, { ...range, id: "custom-overlap", date: "2028-07-11", endDate: "2028-07-13" }] })
  assert.equal(overlap.success, false, "Recurring range overlaps are caught across different occurrence years")

  const leap = { ...custom, id: "custom-leap", date: "2096-02-29" }
  assert.equal(upcomingBusinessHolidays({ holidays: [leap] }, "2097-03-01", "fi").find(({ id }) => id === leap.id)?.date, "2104-02-29")
  assert.deepEqual(defaultBusinessHolidays(2027, "zz"), [])
  console.info("PASS national holidays for every onboarding country, Orthodox Easter, observed days, saved/custom preferences, country validation, recurring closures and booking availability")
} finally {
  await vite.close()
}
