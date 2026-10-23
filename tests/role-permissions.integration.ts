import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import type { OrganizationPermissions } from "../app/lib/auth/permissions"
import { RouterContextProvider } from "react-router"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
process.env.EMAIL_PROVIDER = ""
const vite = await createServer({ configFile: false, appType: "custom", resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
const { prisma } = await vite.ssrLoadModule("/app/lib/prisma.server.ts") as typeof import("../app/lib/prisma.server")
const { auth } = await vite.ssrLoadModule("/app/lib/auth/server.ts") as typeof import("../app/lib/auth/server")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
const { hasOrganizationPermission, getRoutePermissions } = await vite.ssrLoadModule("/app/lib/auth/permissions.ts") as typeof import("../app/lib/auth/permissions")
const { membershipContext, requireRoutePermissionsMiddleware } = await vite.ssrLoadModule("/app/middleware/auth.ts") as typeof import("../app/middleware/auth")
const suffix = randomUUID()
const userIds: string[] = []
const organizationIds: string[] = []
const origin = "http://localhost:5175"

try {
  const headers = new Headers({ origin, host: "localhost:5175" })
  const email = `permissions-${suffix}@example.invalid`
  const otp = await auth.api.createVerificationOTP({ body: { email, type: "sign-in" }, headers })
  const signedIn = await auth.api.signInEmailOTP({ headers, body: { email, otp }, returnHeaders: true })
  headers.set("cookie", signedIn.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; "))
  const user = signedIn.response.user
  userIds.push(user.id)
  const organization = await prisma.organization.create({ data: { name: "Permissions test", slug: `permissions-${suffix}`, createdAt: new Date(), members: { create: { userId: user.id, role: "owner", createdAt: new Date() } }, settings: { create: { timezone: "UTC" } } } })
  organizationIds.push(organization.id)
  await prisma.session.updateMany({ where: { userId: user.id }, data: { activeOrganizationId: organization.id } })
  const authSession = await auth.api.getSession({ headers })
  assert.ok(authSession)
  const caller = appRouter.createCaller({ headers, request: new Request(`${origin}/api/trpc`, { headers }), prisma, user: authSession.user, session: authSession.session, organizationId: organization.id, formatLocale: "en-GB", formatPreference: "eu", locale: "en" })
  const membership = await prisma.member.findFirstOrThrow({ where: { organizationId: organization.id, userId: user.id } })
  const ownStaff = await caller.staff.create({ name: "Own staff", memberId: membership.id })
  const otherStaff = await caller.staff.create({ name: "Other staff" })
  const startsAt = new Date("2030-01-07T10:00:00Z")
  const endsAt = new Date("2030-01-07T11:00:00Z")
  const otherBlock = await caller.availability.createBlockedTime({ staffMemberId: otherStaff.id, startsAt, endsAt })
  const businessOverride = await caller.availability.createOverride({ startsAt, endsAt, isAvailable: false })
  const customer = await caller.customer.create({ firstName: "Customer" })

  for (const role of ["member", "admin", "owner"] as const) {
    await prisma.member.update({ where: { id: membership.id }, data: { role } })
    const routeContext = new RouterContextProvider()
    routeContext.set(membershipContext, { role, staffProfile: { id: ownStaff.id, isActive: true, acceptsAppointments: true } })
    for (const path of ["/services/new", "/team/new", "/booking-page/new"]) {
      const url = new URL(path, origin)
      const checkRoute = async () => requireRoutePermissionsMiddleware({ context: routeContext, url, request: new Request(url), params: {}, pattern: path }, async () => new Response())
      if (role === "member") await assert.rejects(checkRoute, (response: Response) => response.status === 302 && response.headers.get("location") === "/calendar")
      else await checkRoute()
      assert.equal(hasOrganizationPermission(role, getRoutePermissions(path)!), role !== "member", `${role}: ${path}`)
    }
    const operatingPermissions: { [Resource in keyof OrganizationPermissions]?: NonNullable<OrganizationPermissions[Resource]>[number][] }[] = [{ appointments: ["create", "update"] }, { customers: ["create", "update"] }, { availability: ["own"] }]
    for (const permissions of operatingPermissions) {
      assert.equal((await auth.api.hasPermission({ headers, body: { permissions } })).success, true)
    }
    for (const resource of ["services", "bookingPage", "business", "locations", "bookingSettings", "communications"] as const) {
      assert.equal((await auth.api.hasPermission({ headers, body: { permissions: { [resource]: ["configure"] } } })).success, role !== "member")
    }
    assert.equal((await auth.api.hasPermission({ headers, body: { permissions: { team: ["manage"], invitation: ["create"], member: ["update"] } } })).success, role !== "member")
    assert.equal((await auth.api.hasPermission({ headers, body: { permissions: { billing: ["manage"] } } })).success, role === "owner")
    await caller.customer.update({ id: customer.id, firstName: role })
    await caller.appointment.list({ from: startsAt, to: endsAt })
    await caller.availability.replaceRules({ staffMemberId: ownStaff.id, rules: [] })
    const block = await caller.availability.createBlockedTime({ staffMemberId: ownStaff.id, startsAt, endsAt })
    await caller.availability.deleteBlockedTime({ id: block.id })
    const override = await caller.availability.createOverride({ staffMemberId: ownStaff.id, startsAt: new Date("2030-01-08T10:00:00Z"), endsAt: new Date("2030-01-08T11:00:00Z"), isAvailable: true })
    await caller.availability.deleteOverride({ id: override.id })
    if (role === "member") {
      await assert.rejects(caller.team.list(), { code: "FORBIDDEN" })
      await assert.rejects(caller.team.setRole({ memberId: membership.id, role: "admin" }), { code: "FORBIDDEN" })
      await assert.rejects(caller.team.invite({ name: "Invitee", email: `invite-${suffix}@example.invalid`, sendEmail: false }), { code: "FORBIDDEN" })
      await assert.rejects(caller.service.create({ name: "Service", slug: "forbidden", durationMinutes: 30 }), { code: "FORBIDDEN" })
      await assert.rejects(caller.location.create({ name: "Office", slug: "forbidden" }), { code: "FORBIDDEN" })
      await assert.rejects(caller.organizations.updateSettings({ enableAppointmentReminders: false }), { code: "FORBIDDEN" })
      await assert.rejects(caller.availability.getRules({ staffMemberId: otherStaff.id }), { code: "FORBIDDEN" })
      await assert.rejects(caller.availability.replaceRules({ staffMemberId: otherStaff.id, rules: [] }), { code: "FORBIDDEN" })
      await assert.rejects(caller.availability.replaceRules({ rules: [] }), { code: "FORBIDDEN" })
      await assert.rejects(caller.availability.deleteBlockedTime({ id: otherBlock.id }), { code: "FORBIDDEN" })
      await assert.rejects(caller.availability.deleteOverride({ id: businessOverride.id }), { code: "FORBIDDEN" })
      assert.deepEqual(await caller.availability.getRules({}), [])
    } else {
      await caller.team.list()
      await caller.service.create({ name: role, slug: role, durationMinutes: 30 })
      await caller.location.create({ name: role, slug: role })
      await caller.organizations.updateSettings({ enableAppointmentReminders: false })
      await caller.availability.replaceRules({ staffMemberId: otherStaff.id, rules: [] })
    }
    if (role !== "owner") await assert.rejects(caller.billing.subscriptions(), { code: "FORBIDDEN" })
  }

  await prisma.member.update({ where: { id: membership.id }, data: { role: "member" } })
  for (const data of [{ acceptsAppointments: false }, { acceptsAppointments: true, isActive: false }]) {
    await prisma.staffMember.update({ where: { id: ownStaff.id }, data })
    await assert.rejects(caller.availability.replaceRules({ staffMemberId: ownStaff.id, rules: [] }), { code: "FORBIDDEN" })
    await assert.rejects(caller.profile.resetTeamWorkingHours(), { code: "FORBIDDEN" })
  }
  await prisma.staffMember.update({ where: { id: ownStaff.id }, data: { memberId: null } })
  await caller.customer.list({})
  await caller.appointment.list({ from: startsAt, to: endsAt })
  await assert.rejects(caller.availability.replaceRules({ staffMemberId: ownStaff.id, rules: [] }), { code: "FORBIDDEN" })
  await prisma.member.delete({ where: { id: membership.id } })
  await assert.rejects(caller.customer.list({}), { code: "FORBIDDEN" })
  assert.equal(hasOrganizationPermission("unknown", { appointments: ["read"] }), false)
  assert.equal(hasOrganizationPermission(" member, admin ", { business: ["configure"] }), true)
  console.info("PASS Better Auth role matrix, tenant membership, live role changes, billing isolation, own availability and non-bookable reception access")
} finally {
  await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } })
  await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  await prisma.$disconnect()
  await vite.close()
}
