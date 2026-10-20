import "dotenv/config"
import assert from "node:assert/strict"
import { createServer } from "vite"
import { Temporal } from "@js-temporal/polyfill"

const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/calendar-availability-delete", appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
try {
  const { availabilityRouter } = await vite.ssrLoadModule("/app/.server/routers/availability.ts") as typeof import("../app/.server/routers/availability")
  const { createTRPCRouter } = await vite.ssrLoadModule("/app/.server/trpc.ts") as typeof import("../app/.server/trpc")
  const { scheduleAt, replaceScheduleAt } = await vite.ssrLoadModule("/app/lib/calendar/availability.ts") as typeof import("../app/lib/calendar/availability")
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
  const otherBefore = records.filter((rule) => rule.staffMemberId === "other")
  await caller.availability.deleteScheduledChange({ staffMemberId: "own", effectiveFrom: "2030-03-31" })
  assert.equal(scheduleAt(records.filter((rule) => !rule.isBreak && rule.staffMemberId === "own"), first)[0].startMinute, 480, "Deleting restores the preceding working hours")
  assert.equal(scheduleAt(records.filter((rule) => rule.isBreak), first)[0].startMinute, 720, "Deleting restores the preceding breaks")
  assert.equal(scheduleAt(records.filter((rule) => !rule.isBreak && rule.staffMemberId === "own"), second)[0].startMinute, 720, "Later scheduled hours remain unchanged")
  assert.equal(scheduleAt(records.filter((rule) => rule.isBreak), second)[0].startMinute, 840)
  assert.deepEqual(records.filter((rule) => rule.staffMemberId === "other"), otherBefore)
  await assert.rejects(caller.availability.deleteScheduledChange({ staffMemberId: "own", effectiveFrom: "2030-03-31" }), { code: "NOT_FOUND" })
  await assert.rejects(caller.availability.deleteScheduledChange({ staffMemberId: "own", effectiveFrom: "2020-01-01" }), { code: "BAD_REQUEST" })
  await assert.rejects(caller.availability.deleteScheduledChange({ staffMemberId: "own", effectiveFrom: Temporal.Now.plainDateISO(timezone).toString() }), { code: "BAD_REQUEST" })
  role = "member"
  await assert.rejects(caller.availability.deleteScheduledChange({ staffMemberId: "other", effectiveFrom: "2030-04-07" }), { code: "FORBIDDEN" })
  await caller.availability.deleteScheduledChange({ staffMemberId: "own", effectiveFrom: "2030-04-07" })
  assert.equal(records.filter((rule) => rule.staffMemberId === "own").length, 2, "Deleting the last change reconnects the current hours and breaks indefinitely")
  const anonymous = router.createCaller({ ...context, user: undefined } as unknown as Parameters<typeof router.createCaller>[0])
  await assert.rejects(anonymous.availability.deleteScheduledChange({ staffMemberId: "own", effectiveFrom: "2030-04-07" }), { code: "UNAUTHORIZED" })
  console.info("PASS upcoming change deletion, restored hours and breaks, later versions, member access and authentication")
} finally {
  await vite.close()
}
