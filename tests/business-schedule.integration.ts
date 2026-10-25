import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
process.env.EMAIL_PROVIDER = ""
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/business-schedule", appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { ws: false, middlewareMode: true, hmr: false, watch: null } })
const { prisma } = await vite.ssrLoadModule("/app/lib/database/prisma.server.ts") as typeof import("../app/lib/database/prisma.server.ts")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
const { defaultBusinessHolidays, holidaysForYear, businessHolidayWindows, upcomingBusinessHolidays } = await vite.ssrLoadModule("/app/lib/business/business-holidays.ts") as typeof import("../app/lib/business/business-holidays")
const { businessScheduleSchema } = await vite.ssrLoadModule("/app/lib/schemas/business-schedule.ts") as typeof import("../app/lib/schemas/business-schedule")
let organizationId: string | undefined
let userId: string | undefined
try {
  assert.equal(defaultBusinessHolidays(2026).find((day) => day.id === "goodFriday")?.date, "2026-04-03")
  assert.equal(defaultBusinessHolidays(2027).find((day) => day.id === "easterMonday")?.date, "2027-03-29")
  assert.equal(defaultBusinessHolidays(2028).find((day) => day.id === "ascension")?.date, "2028-05-25")
  for (let year = 1900; year <= 2200; year++) {
    const days = defaultBusinessHolidays(year)
    assert.equal(new Set(days.map((day) => day.id)).size, days.length)
    assert.equal(businessScheduleSchema.safeParse({ holidays: days, workingHours: [], breaks: [] }).success, true)
  }
  assert.equal(defaultBusinessHolidays(2026).find((day) => day.id === "midsummer")?.date, "2026-06-20")
  assert.equal(defaultBusinessHolidays(2026).find((day) => day.id === "midsummerEve")?.date, "2026-06-19")
  assert.equal(defaultBusinessHolidays(2026).find((day) => day.id === "allSaints")?.date, "2026-10-31")
  assert.equal(defaultBusinessHolidays(2027).find((day) => day.id === "allSaints")?.date, "2027-11-06")
  assert.equal(defaultBusinessHolidays(2026).find((day) => day.id === "independence")?.date, "2026-12-06")
  assert.ok(!defaultBusinessHolidays(2026).some((day) => ["whitMonday", "corpusChristi", "assumption"].includes(day.id)))
  const upcoming = upcomingBusinessHolidays(null, "2026-10-21")
  assert.equal(upcoming[0].id, "allSaints")
  assert.equal(upcoming.find((day) => day.id === "newYear")?.date, "2027-01-01")
  assert.equal(upcoming.find((day) => day.id === "midsummer")?.date, "2027-06-26")
  const nextYear = upcomingBusinessHolidays(null, "2027-01-01")
  assert.equal(nextYear.find((day) => day.id === "newYear")?.date, "2027-01-01")
  const custom = { id: "custom-summer", name: "Summer break", date: "2026-07-10", enabled: true, closed: true, startMinute: 540, endMinute: 1020 }
  assert.equal(upcomingBusinessHolidays({ holidays: [custom] }, "2026-10-21").find((day) => day.id === custom.id)?.date, "2027-07-10")
  const legacy = { "2026": [{ ...custom }, { ...defaultBusinessHolidays(2026).find((day) => day.id === "christmas")!, closed: false, startMinute: 600, endMinute: 720 }] }
  assert.equal(holidaysForYear(legacy, 2027).find((day) => day.id === "christmas")?.closed, false)
  assert.equal(holidaysForYear(legacy, 2027).find((day) => day.id === custom.id)?.date, "2027-07-10")
  const dst = businessHolidayWindows({ "2026": [{ id: "custom-dst", name: "DST closure", date: "2026-03-29", closed: true, startMinute: 540, endMinute: 1020 }] }, new Date("2026-03-28T22:00Z"), new Date("2026-03-29T22:00Z"), "Europe/Helsinki")
  assert.equal(dst[0].end - dst[0].start, 23 * 3600000, "Closed days respect daylight saving transitions")
  const suffix = randomUUID()
  const user = await prisma.user.create({ data: { name: "Business hours test", email: `business-hours-${suffix}@example.invalid`, emailVerified: true } })
  userId = user.id
  const org = await prisma.organization.create({ data: { name: "Business hours test", slug: `business-hours-${suffix}`, createdAt: new Date(), settings: { create: { timezone: "Europe/Helsinki" } }, members: { create: { userId, role: "owner", createdAt: new Date() } } } })
  organizationId = org.id
  const session = await prisma.session.create({ data: { token: randomUUID(), userId, activeOrganizationId: organizationId, expiresAt: new Date(Date.now() + 86400000) } })
  const caller = appRouter.createCaller({ headers: new Headers(), request: undefined, prisma, user, session, organizationId, formatPreference: "eu", formatLocale: "fi-FI", locale: "en" })
  const service = await caller.service.create({ name: "Test", slug: "test", durationMinutes: 30, deliveryType: "ONLINE" })
  const staff = await caller.staff.create({ name: "Test", serviceIds: [service.id] })
  const workingHours = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, startMinute: 480, endMinute: 1080, timezone: "Europe/Helsinki", isActive: true }))
  const values = { workingHours, breaks: [], holidays: defaultBusinessHolidays(2026) }
  await caller.organizations.updateBusinessSchedule(values)
  const from = new Date("2026-12-24T22:00:00Z")
  const to = new Date("2026-12-25T22:00:00Z")
  const slotQuery = { serviceId: service.id, staffMemberId: staff.id, from, to }
  assert.equal((await caller.availability.getSlots(slotQuery)).days.length, 0, "Default Christmas closure blocks booking")
  const holidays = values.holidays.map((day) => day.id === "christmas" ? { ...day, closed: false, startMinute: 600, endMinute: 720 } : day)
  await caller.organizations.updateBusinessSchedule({ ...values, holidays })
  const slots = (await caller.availability.getSlots(slotQuery)).days.flatMap((day) => day.slots)
  assert.equal(slots.length, 7)
  assert.equal(slots[0].startsAt, "2026-12-25T08:00:00.000Z")
  assert.equal(slots.at(-1)?.endsAt, "2026-12-25T10:00:00.000Z")
  const schedule = await caller.availability.calendarSchedule({ from, to })
  assert.ok(schedule.some((rule) => "isExtra" in rule && rule.isExtra))
  assert.equal(schedule.filter((rule) => "isBlocked" in rule && rule.isBlocked).length, 2)
  const disabled = holidays.map((day) => day.id === "christmas" ? { ...day, enabled: false } : day)
  await caller.organizations.updateBusinessSchedule({ ...values, holidays: disabled })
  assert.equal((await caller.availability.getSlots(slotQuery)).days.flatMap((day) => day.slots).length, 39, "Disabled holidays leave normal hours available")
  const saved = (await caller.organizations.getCurrent()).settings?.businessHolidays
  assert.equal(holidaysForYear(saved, 2027).find((day) => day.id === "christmas")?.enabled, false, "Switches persist across years")
  assert.equal(holidaysForYear(saved, 2027).find((day) => day.id === "christmas")?.startMinute, 600, "Custom hours persist across years")
  await assert.rejects(caller.organizations.updateBusinessSchedule({ ...values, holidays: values.holidays.slice(1) }), { code: "BAD_REQUEST" })
  await assert.rejects(caller.organizations.updateBusinessSchedule({ ...values, holidays: values.holidays.map((day) => day.id === "christmas" ? { ...day, name: "Changed" } : day) }), { code: "BAD_REQUEST" })
  await caller.organizations.updateBusinessSchedule({ ...values, holidays: [...disabled, custom] })
  const withCustom = (await caller.organizations.getCurrent()).settings?.businessHolidays
  assert.equal(holidaysForYear(withCustom, 2028).find((day) => day.id === custom.id)?.date, "2028-07-10", "Saved custom holidays recur annually")
  const rulesBeforeModal = await caller.availability.getRules({})
  const modalHoliday = { ...custom, id: "custom-modal", name: "Modal holiday", date: "2026-10-22" }
  await caller.organizations.saveCustomBusinessHoliday(modalHoliday)
  const afterModal = (await caller.organizations.getCurrent()).settings?.businessHolidays
  assert.equal(upcomingBusinessHolidays(afterModal, "2026-10-21").find((day) => day.id === modalHoliday.id)?.name, "Modal holiday", "Modal add persists without another schedule save")
  assert.equal(holidaysForYear(afterModal, 2027).find((day) => day.id === "christmas")?.enabled, false, "Adding a holiday preserves other saved settings")
  assert.deepEqual(await caller.availability.getRules({}), rulesBeforeModal, "Modal add does not replace weekly hours")
  await caller.organizations.saveCustomBusinessHoliday({ ...modalHoliday, name: "Edited modal holiday" })
  const afterEdit = (await caller.organizations.getCurrent()).settings?.businessHolidays
  assert.equal(holidaysForYear(afterEdit, 2027).filter((day) => day.id === modalHoliday.id).length, 1)
  assert.equal(holidaysForYear(afterEdit, 2027).find((day) => day.id === modalHoliday.id)?.name, "Edited modal holiday")
  await assert.rejects(caller.organizations.saveCustomBusinessHoliday({ ...modalHoliday, id: "custom-conflict", date: "2026-12-06" }), { code: "BAD_REQUEST" })
  await assert.rejects(caller.organizations.saveCustomBusinessHoliday(values.holidays[0]), { code: "BAD_REQUEST" })
  const invalid = { ...holidays[0], closed: false, startMinute: 900, endMinute: 600 }
  await assert.rejects(caller.organizations.updateBusinessSchedule({ ...values, holidays: [invalid] }), { code: "BAD_REQUEST" })
  await assert.rejects(caller.organizations.updateBusinessSchedule({ ...values, holidays: [holidays[0], holidays[0]] }), { code: "BAD_REQUEST" })
  const exception = { id: "exception-test", name: "Special opening hours", date: "2026-12-25", enabled: true, closed: false, startMinute: 660, endMinute: 780 }
  await caller.organizations.saveBusinessException(exception)
  const exceptionSlots = (await caller.availability.getSlots(slotQuery)).days.flatMap((day) => day.slots)
  assert.equal(exceptionSlots.length, 7, "Date exceptions replace the usual opening hours")
  assert.equal(exceptionSlots[0].startsAt, "2026-12-25T09:00:00.000Z")
  assert.equal(exceptionSlots.at(-1)?.endsAt, "2026-12-25T11:00:00.000Z")
  await caller.organizations.updateBusinessSchedule({ ...values, holidays })
  const preserved = (await caller.organizations.getCurrent()).settings?.businessHolidays
  assert.equal(businessHolidayWindows(preserved, from, to, "Europe/Helsinki").find((window) => window.isOpen)?.holidayId, exception.id, "Saving weekly hours preserves exceptions and exceptions replace holidays")
  await caller.organizations.saveCustomBusinessHoliday(modalHoliday)
  const afterHolidaySave = (await caller.organizations.getCurrent()).settings?.businessHolidays
  assert.equal(businessHolidayWindows(afterHolidaySave, from, to, "Europe/Helsinki").find((window) => window.isOpen)?.holidayId, exception.id, "Saving a holiday preserves exceptions")
  const nextChristmas = businessHolidayWindows(afterHolidaySave, new Date("2027-12-24T22:00Z"), new Date("2027-12-25T22:00Z"), "Europe/Helsinki")
  assert.ok(nextChristmas.every((window) => window.holidayId !== exception.id), "Exceptions do not repeat annually")
  const exceptionSchedule = await caller.availability.calendarSchedule({ from, to })
  assert.ok(exceptionSchedule.some((rule) => "title" in rule && rule.title === exception.name), "Calendar shows exception names")
  await assert.rejects(caller.organizations.saveBusinessException({ ...exception, id: "exception-duplicate" }), { code: "BAD_REQUEST" })
  await assert.rejects(caller.organizations.saveBusinessException({ ...exception, closed: false, endMinute: 600 }), { code: "BAD_REQUEST" })
  await caller.organizations.saveBusinessException({ ...exception, closed: true })
  assert.equal((await caller.availability.getSlots(slotQuery)).days.length, 0, "A full-day exception closes an otherwise open holiday")
  await caller.organizations.removeBusinessException({ id: exception.id })
  assert.equal((await caller.availability.getSlots(slotQuery)).days.flatMap((day) => day.slots)[0].startsAt, "2026-12-25T08:00:00.000Z", "Removing the exception restores the holiday hours")
  await prisma.member.updateMany({ where: { organizationId, userId }, data: { role: "member" } })
  await assert.rejects(caller.organizations.updateBusinessSchedule(values), { code: "FORBIDDEN" })
  await assert.rejects(caller.organizations.saveCustomBusinessHoliday(modalHoliday), { code: "FORBIDDEN" })
  await assert.rejects(caller.organizations.saveBusinessException(exception), { code: "FORBIDDEN" })
  await assert.rejects(caller.organizations.removeBusinessException({ id: exception.id }), { code: "FORBIDDEN" })
  console.info("PASS one-off exceptions, holiday precedence, exception edits and removal, preservation, permissions, Finnish dates, next occurrences, recurring custom holidays, legacy settings, switches, immutable defaults, DST, booking hours, validation and permissions")
} finally {
  if (organizationId) await prisma.organization.delete({ where: { id: organizationId } })
  if (userId) await prisma.user.delete({ where: { id: userId } })
  await prisma.$disconnect()
  await vite.close()
}
