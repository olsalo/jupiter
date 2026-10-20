import "dotenv/config"
import assert from "node:assert/strict"
import { createServer } from "vite"
import type { TimeOffValues } from "../app/lib/team-time-off.ts"

const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/calendar-block-time", appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
try {
  const { availabilityRouter } = await vite.ssrLoadModule("/app/.server/routers/availability.ts") as typeof import("../app/.server/routers/availability")
  const { createTRPCRouter } = await vite.ssrLoadModule("/app/.server/trpc.ts") as typeof import("../app/.server/trpc")
  const router = createTRPCRouter({ availability: availabilityRouter })
  const records: { id: string; organizationId: string; staffMemberId: string; locationId: null; title: string; startsAt: Date; endsAt: Date; recurrence?: TimeOffValues & { timezone: string } }[] = []
  type Record = typeof records[number]
  let role = "owner"
  const db = {
    $queryRaw: async () => [],
    member: { findFirst: async () => ({ role, organization: { id: "business", settings: {} }, staffProfile: { id: "own", isActive: true, acceptsAppointments: true } }) },
    staffMember: {
      findFirst: async ({ where }: { where: { id: string } }) => ["own", "other"].includes(where.id) ? { id: where.id } : null,
      findUniqueOrThrow: async () => ({ timezone: "Europe/Helsinki" }),
    },
    organizationSettings: { findUnique: async () => ({ timezone: "UTC" }) },
    availabilityRule: { findMany: async () => [] },
    availabilityOverride: { findMany: async () => [] },
    blockedTime: {
      createMany: async ({ data }: { data: Record[] }) => { records.push(...data.map((record, index) => ({ ...record, id: `${records.length + index}`, locationId: null }))); return { count: data.length } },
      findMany: async ({ where }: { where: { staffMemberId?: string } }) => records.filter((record) => !where.staffMemberId || record.staffMemberId === where.staffMemberId),
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
  }
  const context = { headers: new Headers(), user: { id: "user" }, session: { activeOrganizationId: "business" }, organizationId: "business", prisma: db }
  const caller = router.createCaller(context as unknown as Parameters<typeof router.createCaller>[0])
  const values = { staffMemberId: "other", title: "Lunch", startDate: "2030-10-14", endDate: "2030-10-14", allDay: false, startTime: "12:00", endTime: "13:00", repeat: "weekly" as const, repeatUntil: "2030-11-01" }
  await caller.availability.addTimeOff(values)
  assert.equal(records.length, 1, "Repeating blocked time uses the existing time off series storage")
  assert.equal(records[0].startsAt.toISOString(), "2030-10-14T09:00:00.000Z", "Uses the selected member's timezone")
  assert.equal((await caller.availability.getTimeOff({ staffMemberId: "other" }))[0].title, "Lunch", "Calendar blocks also appear in team time off")
  const range = { from: new Date("2030-10-27T22:00:00Z"), to: new Date("2030-10-28T22:00:00Z") }
  const schedule = await caller.availability.calendarSchedule(range)
  assert.deepEqual(schedule, [{ staffMemberId: "other", locationId: null, isBreak: false, isBlocked: true, title: "Lunch", windows: [{ start: +new Date("2030-10-28T10:00:00Z"), end: +new Date("2030-10-28T11:00:00Z") }] }], "The calendar receives the correct occurrence after daylight saving changes")
  await assert.rejects(caller.availability.addTimeOff({ ...values, endTime: "11:00" }), { code: "BAD_REQUEST" })
  role = "member"
  await assert.rejects(caller.availability.addTimeOff(values), { code: "FORBIDDEN" })
  await caller.availability.addTimeOff({ ...values, staffMemberId: "own", repeat: "none", allDay: true })
  assert.equal(records[1].startsAt.toISOString(), "2030-10-13T21:00:00.000Z")
  assert.equal(records[1].endsAt.toISOString(), "2030-10-14T21:00:00.000Z", "Members can block their own full day")
  role = "owner"
  await assert.rejects(caller.availability.addTimeOff({ ...values, staffMemberId: "foreign" }), { code: "NOT_FOUND" })
  console.log("Calendar block time mutation, recurrence and access checks passed")
} finally {
  await vite.close()
}
