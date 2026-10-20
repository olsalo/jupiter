import "dotenv/config"
import assert from "node:assert/strict"
import { createServer } from "vite"

const vite = await createServer({ configFile: false, appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
try {
  const { serviceRouter } = await vite.ssrLoadModule("/app/.server/routers/services.ts") as typeof import("../app/.server/routers/services")
  const { createTRPCRouter } = await vite.ssrLoadModule("/app/.server/trpc.ts") as typeof import("../app/.server/trpc")
  const router = createTRPCRouter({ service: serviceRouter })
  const queries: unknown[] = []
  const context = {
    headers: new Headers(), user: { id: "owner" }, session: { activeOrganizationId: "business" }, organizationId: "business",
    prisma: {
      member: { findFirst: async () => ({ role: "owner", organization: { id: "business", settings: {} }, staffProfile: null }) },
      appointmentService: { groupBy: async (input: unknown) => { queries.push(input); return [{ serviceId: "popular", _count: { _all: 12 } }] } },
    },
  }
  const caller = router.createCaller(context as unknown as Parameters<typeof router.createCaller>[0])
  assert.deepEqual(await caller.service.bookingUsage(), [{ serviceId: "popular", bookings: 12 }])
  assert.deepEqual(queries[0], {
    by: ["serviceId"],
    where: { appointment: { organizationId: "business", status: { notIn: ["CANCELLED", "NO_SHOW"] } }, service: { organizationId: "business", deletedAt: null, isActive: true } },
    _count: { _all: true },
  }, "Popularity counts stay within the business and exclude cancelled, missed and inactive services")
  const anonymous = router.createCaller({ ...context, user: undefined } as unknown as Parameters<typeof router.createCaller>[0])
  await assert.rejects(anonymous.service.bookingUsage(), { code: "UNAUTHORIZED" })
  const otherBusiness = router.createCaller({ ...context, organizationId: "other-business" } as unknown as Parameters<typeof router.createCaller>[0])
  await assert.rejects(otherBusiness.service.bookingUsage(), { code: "FORBIDDEN" })
  assert.equal(queries.length, 1, "Unauthorized requests never query service usage")
  console.info("PASS service popularity counts, business scoping and authentication")
} finally {
  await vite.close()
}
