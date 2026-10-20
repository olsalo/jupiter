import "dotenv/config"
import assert from "node:assert/strict"
import { createServer } from "vite"

const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/calendar-extra-hours", appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
try {
  const { availabilityRouter } = await vite.ssrLoadModule("/app/.server/routers/availability.ts") as typeof import("../app/.server/routers/availability")
  const { createTRPCRouter } = await vite.ssrLoadModule("/app/.server/trpc.ts") as typeof import("../app/.server/trpc")
  const router = createTRPCRouter({ availability: availabilityRouter })
  type Entry = { id: string; organizationId: string; staffMemberId: string; locationId: string | null; startsAt: Date; endsAt: Date; isAvailable: boolean }
  let records: Entry[] = []
  let role = "owner"
  const matches = (record: Entry, where: Partial<Entry>) => Object.entries(where).every(([key, value]) => {
    if (typeof value === "object" && value && !(value instanceof Date)) {
      if (key === "endsAt") return record.endsAt > (value as { gt: Date }).gt
      return true
    }
    return key === "AND" || record[key as keyof Entry] === value
  })
  const db = {
    $queryRaw: async () => [],
    member: { findFirst: async () => ({ role, organization: { id: "business", settings: {} }, staffProfile: { id: "own", isActive: true, acceptsAppointments: true } }) },
    staffMember: { findFirst: async ({ where }: { where: { id: string } }) => ["own", "other"].includes(where.id) ? { id: where.id } : null },
    availabilityOverride: {
      findFirst: async ({ where }: { where: Partial<Entry> }) => records.find((record) => matches(record, where)) ?? null,
      findMany: async ({ where }: { where: Partial<Entry> }) => records.filter((record) => matches(record, where)),
      create: async ({ data }: { data: Entry }) => { const record = { ...data, locationId: data.locationId ?? null, id: `${records.length}` }; records.push(record); return record },
      deleteMany: async ({ where }: { where: Partial<Entry> }) => { const before = records.length; records = records.filter((record) => !matches(record, where)); return { count: before - records.length } },
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(db),
  }
  const context = { headers: new Headers(), user: { id: "user" }, session: { activeOrganizationId: "business" }, organizationId: "business", prisma: db }
  const caller = router.createCaller(context as unknown as Parameters<typeof router.createCaller>[0])
  const values = { staffMemberId: "other", startsAt: new Date("2090-01-07T08:00:00Z"), endsAt: new Date("2090-01-07T12:00:00Z"), isAvailable: true }
  const created = await caller.availability.createOverride(values)
  assert.equal((await caller.availability.getExtraHours({ staffMemberId: "other" }))[0].id, created.id)
  await caller.availability.createOverride({ ...values, staffMemberId: "own" })
  await caller.availability.createOverride({ ...values, startsAt: new Date("2020-01-01"), endsAt: new Date("2020-01-02") })
  assert.equal((await caller.availability.getExtraHours({ staffMemberId: "other" })).length, 1, "Upcoming extra hours exclude past shifts and other members")
  await assert.rejects(caller.availability.createOverride({ ...values, endsAt: values.startsAt }), { code: "BAD_REQUEST" })
  role = "member"
  await assert.rejects(caller.availability.getExtraHours({ staffMemberId: "other" }), { code: "FORBIDDEN" })
  await assert.rejects(caller.availability.createOverride(values), { code: "FORBIDDEN" })
  await assert.rejects(caller.availability.deleteOverride({ id: created.id }), { code: "FORBIDDEN" })
  assert.equal((await caller.availability.getExtraHours({ staffMemberId: "own" })).length, 1)
  role = "owner"
  await assert.rejects(caller.availability.getExtraHours({ staffMemberId: "foreign" }), { code: "NOT_FOUND" })
  await caller.availability.deleteOverride({ id: created.id })
  assert.equal((await caller.availability.getExtraHours({ staffMemberId: "other" })).length, 0)
  console.log("Extra hours creation, upcoming list, removal and access checks passed")
} finally {
  await vite.close()
}
