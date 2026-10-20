import "dotenv/config"
import assert from "node:assert/strict"
import { createServer } from "vite"
import { Temporal } from "@js-temporal/polyfill"

const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/calendar-independent-schedules", appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
try {
  const { availabilityRouter } = await vite.ssrLoadModule("/app/.server/routers/availability.ts") as typeof import("../app/.server/routers/availability")
  const { createTRPCRouter } = await vite.ssrLoadModule("/app/.server/trpc.ts") as typeof import("../app/.server/trpc")
  const { scheduleAt, replaceScheduleAt } = await vite.ssrLoadModule("/app/lib/calendar/availability.ts") as typeof import("../app/lib/calendar/availability")
  const { saveStaffSchedule } = await vite.ssrLoadModule("/app/.server/services/staff-schedule.ts") as typeof import("../app/.server/services/staff-schedule")
  const router = createTRPCRouter({ availability: availabilityRouter })
  const timezone = "Europe/Helsinki"
  const first = new Date("2030-03-30T22:00:00Z")
  const second = new Date("2030-04-06T21:00:00Z")
  const base = { dayOfWeek: 1, startMinute: 480, endMinute: 1020, timezone, isActive: true, validFrom: null, validUntil: null }
  const hours = replaceScheduleAt(replaceScheduleAt([base], [{ ...base, startMinute: 600 }], first, timezone), [{ ...base, startMinute: 720 }], second, timezone)
  const breaks = replaceScheduleAt(replaceScheduleAt([{ ...base, startMinute: 720, endMinute: 750 }], [{ ...base, startMinute: 780, endMinute: 810 }], first, timezone), [{ ...base, startMinute: 840, endMinute: 870 }], second, timezone)
  let records = [...hours.map((rule) => ({ ...rule, organizationId: "business", staffMemberId: "own", locationId: null, isBreak: false })), ...breaks.map((rule) => ({ ...rule, organizationId: "business", staffMemberId: "own", locationId: null, isBreak: true })), { ...base, organizationId: "business", staffMemberId: "other", locationId: null, isBreak: false }]
  type Rule = typeof records[number]
  const matches = (rule: Rule, where: Record<string, unknown>) => Object.entries(where).every(([key, value]) => rule[key as keyof Rule] === value)
  let role = "owner"
  const db = {
    $queryRaw: async () => [],
    member: { findFirst: async () => ({ role, organization: { id: "business", settings: {} }, staffProfile: { id: "own", isActive: true, acceptsAppointments: true } }) },
    staffMember: { findFirst: async () => ({ id: "own" }) },
    organizationSettings: { findUnique: async () => ({ timezone }) },
    availabilityRule: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => records.filter((rule) => matches(rule, where)),
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => { records = records.filter((rule) => !matches(rule, where)); return { count: 1 } },
      createMany: async ({ data }: { data: Rule[] }) => { records.push(...data); return { count: data.length } },
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
  }
  const context = { headers: new Headers(), user: { id: "user" }, session: { activeOrganizationId: "business" }, organizationId: "business", prisma: db }
  const caller = router.createCaller(context as unknown as Parameters<typeof router.createCaller>[0])
  const before = structuredClone(records)
  const breakRecords = () => records.filter((rule) => rule.isBreak)
  const hourRecords = () => records.filter((rule) => !rule.isBreak)
  const initialBreaks = structuredClone(breakRecords())
  await caller.availability.saveSchedule({ staffMemberId: "own", kind: "workingHours", effectiveFrom: "2030-03-31", workingHours: [{ ...base, startMinute: 660 }], breaks: [] })
  assert.deepEqual(breakRecords(), initialBreaks, "Saving working hours leaves every break version unchanged")
  assert.equal(scheduleAt(hourRecords().filter((rule) => rule.staffMemberId === "own"), first)[0].startMinute, 660)
  const savedHours = structuredClone(hourRecords())
  await caller.availability.saveSchedule({ staffMemberId: "own", kind: "breaks", effectiveFrom: "2030-03-31", workingHours: [], breaks: [{ ...base, startMinute: 800, endMinute: 830 }] })
  assert.deepEqual(hourRecords(), savedHours, "Saving breaks never clears or edits working hours")
  assert.equal(scheduleAt(breakRecords(), first)[0].startMinute, 800)
  const savedBreaks = structuredClone(breakRecords())
  await caller.availability.deleteScheduledChange({ staffMemberId: "own", kind: "workingHours", effectiveFrom: "2030-03-31" })
  assert.deepEqual(breakRecords(), savedBreaks, "Deleting an hours change leaves the break change on the same date intact")
  assert.equal(scheduleAt(hourRecords().filter((rule) => rule.staffMemberId === "own"), first)[0].startMinute, 480)
  const remainingHours = structuredClone(hourRecords())
  await caller.availability.deleteScheduledChange({ staffMemberId: "own", kind: "breaks", effectiveFrom: "2030-03-31" })
  assert.deepEqual(hourRecords(), remainingHours, "Deleting a break change leaves hours unchanged")
  assert.equal(scheduleAt(breakRecords(), first)[0].startMinute, 720)
  await assert.rejects(caller.availability.deleteScheduledChange({ staffMemberId: "own", kind: "breaks", effectiveFrom: "2030-03-31" }), { code: "NOT_FOUND" })
  const breaksBeforeMove = structuredClone(breakRecords())
  await caller.availability.saveSchedule({ staffMemberId: "own", kind: "workingHours", previousEffectiveFrom: "2030-04-07", effectiveFrom: "2030-04-09", workingHours: [{ ...base, startMinute: 690 }], breaks: [] })
  assert.deepEqual(breakRecords(), breaksBeforeMove, "Moving an hours change does not move breaks")
  assert.equal(scheduleAt(hourRecords().filter((rule) => rule.staffMemberId === "own"), second)[0].startMinute, 480)
  const today = new Date(Temporal.Now.plainDateISO(timezone).toZonedDateTime(timezone).epochMilliseconds)
  const ownHours = () => hourRecords().filter((rule) => rule.staffMemberId === "own")
  const nextHoursDate = new Date("2030-04-08T21:00:00Z")
  const futureHours = scheduleAt(ownHours(), nextHoursDate)
  const futureBreaks = scheduleAt(breakRecords(), second)
  const untouchedBreaks = structuredClone(breakRecords())
  await saveStaffSchedule(db as unknown as Parameters<typeof saveStaffSchedule>[0], { organizationId: "business", staffMemberId: "own", kind: "workingHours", replacement: [{ ...base, startMinute: 555 }], at: today, timezone })
  assert.equal(scheduleAt(ownHours(), today)[0].startMinute, 555, "Team and profile saves update today's schedule")
  assert.deepEqual(scheduleAt(ownHours(), nextHoursDate), futureHours, "Saving today's hours preserves upcoming calendar schedules")
  assert.deepEqual(breakRecords(), untouchedBreaks, "Saving today's hours preserves breaks")
  await saveStaffSchedule(db as unknown as Parameters<typeof saveStaffSchedule>[0], { organizationId: "business", staffMemberId: "own", kind: "breaks", replacement: [], at: today, timezone })
  assert.ok(scheduleAt(breakRecords(), today).every((rule) => !rule.isActive), "Clearing today's breaks removes all current breaks")
  assert.deepEqual(scheduleAt(breakRecords(), second), futureBreaks, "Clearing today's breaks preserves upcoming calendar breaks")
  assert.equal(scheduleAt(ownHours(), today)[0].startMinute, 555)
  role = "member"
  await assert.rejects(caller.availability.saveSchedule({ staffMemberId: "other", kind: "breaks", effectiveFrom: "2030-03-31", workingHours: [], breaks: [] }), { code: "FORBIDDEN" })
  await assert.rejects(caller.availability.deleteScheduledChange({ staffMemberId: "other", kind: "workingHours", effectiveFrom: "2030-04-07" }), { code: "FORBIDDEN" })
  assert.deepEqual(records.filter((rule) => rule.staffMemberId === "other"), before.filter((rule) => rule.staffMemberId === "other"))
  console.info("PASS independent saving, deletion, effective dates, moving changes and permissions for hours and breaks")
} finally {
  await vite.close()
}
