import "dotenv/config"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createServer } from "vite"

// Uses disposable records in the configured development database. Never sends mail.
process.env.NODE_ENV = "test"
process.env.EMAIL_PROVIDER = ""
const vite = await createServer({
  configFile: false,
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, hmr: false, watch: null },
})
const { auth } = await vite.ssrLoadModule("/app/lib/auth/server.ts") as typeof import("../app/lib/auth/server")
const { prisma } = await vite.ssrLoadModule("/app/lib/prisma.server.ts") as typeof import("../app/lib/prisma.server")
const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
const { getSafeRedirectTo } = await vite.ssrLoadModule("/app/lib/auth/redirect.ts") as typeof import("../app/lib/auth/redirect")
const suffix = randomUUID()
const emails = ["owner", "recipient", "other"].map((name) => `${name}-${suffix}@example.invalid`)
const orgIds: string[] = []
const origin = "http://localhost:5175"

async function signIn(email: string) {
  const headers = new Headers({ origin, host: "localhost:5175" })
  const otp = await auth.api.createVerificationOTP({ body: { email, type: "sign-in" }, headers })
  const result = await auth.api.signInEmailOTP({
    headers,
    body: { email, otp },
    returnHeaders: true,
  })
  headers.set("cookie", result.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; "))
  return { headers, user: result.response.user }
}

async function caller(headers: Headers) {
  const session = await auth.api.getSession({ headers })
  const member = session ? await prisma.member.findFirst({
    where: { userId: session.user.id, ...(session.session.activeOrganizationId ? { organizationId: session.session.activeOrganizationId } : {}) },
  }) : null
  return appRouter.createCaller({
    headers,
    request: new Request(`${origin}/api/trpc`, { method: "POST", headers }),
    prisma,
    user: session?.user,
    session: session?.session,
    organizationId: member?.organizationId ?? null,
    formatLocale: "fi-FI",
    formatPreference: "eu",
    locale: "en",
  })
}

try {
  assert.equal(getSafeRedirectTo(new URLSearchParams({ redirectTo: "/invite/abc.data?_routes=routes/invite" })), "/invite/abc")
  for (const redirectTo of ["//evil.example", "///", "/a/..//evil.example", "/\\evil.example", "/\n/evil.example", "https://evil.example"]) {
    assert.equal(getSafeRedirectTo(new URLSearchParams({ redirectTo })), "/")
  }
  console.info("PASS safe invite redirects and external redirect rejection")

  const accounts = await Promise.allSettled(emails.map(signIn))
  const [owner, recipient, other] = accounts.map((account) => {
    if (account.status === "rejected") throw account.reason
    return account.value
  })
  const organization = await prisma.organization.create({
    data: {
      name: `Invite test ${suffix}`,
      slug: `invite-test-${suffix}`,
      createdAt: new Date(),
      members: { create: { userId: owner.user.id, role: "owner", createdAt: new Date() } },
    },
  })
  orgIds.push(organization.id)
  const ownerCaller = await caller(owner.headers)
  const recipientCaller = await caller(recipient.headers)
  const otherCaller = await caller(other.headers)
  const anonymousCaller = await caller(new Headers())
  await assert.rejects(anonymousCaller.team.list(), { code: "UNAUTHORIZED" })
  await assert.rejects(otherCaller.team.list(), { code: "FORBIDDEN" })
  await assert.rejects(otherCaller.team.invite({ name: "Invitee", email: emails[0] }), { code: "FORBIDDEN" })
  const invitation = await ownerCaller.team.invite({ name: "Invitee", email: `  ${emails[1].toUpperCase()}  ` })
  assert.ok(invitation.id)
  assert.equal((await ownerCaller.team.list()).invitations.length, 1)
  assert.equal((await ownerCaller.team.invite({ name: "Invitee", email: emails[1] })).error, "alreadyInvited")
  assert.equal((await ownerCaller.team.invite({ name: "Invitee", email: emails[0] })).error, "alreadyMember")
  const adminInvitation = await ownerCaller.team.invite({ name: "Invitee", email: emails[2], role: "admin" })
  assert.ok(adminInvitation.id)
  assert.equal((await prisma.invitation.findUnique({ where: { id: adminInvitation.id } }))?.role, "admin")
  await prisma.invitation.delete({ where: { id: adminInvitation.id } })
  console.info("PASS invitation creation, normalized email, duplicate checks, team access")

  const input = { invitationId: invitation.id }
  if (process.env.TEST_BASE_URL) {
    const path = `/invite/${invitation.id}`
    const signedOut = await fetch(new URL(path, process.env.TEST_BASE_URL), { redirect: "manual" })
    assert.equal(signedOut.status, 302)
    assert.equal(signedOut.headers.get("location"), `/auth?${new URLSearchParams({ redirectTo: path })}`)
    const signedIn = await fetch(new URL(`/auth?${new URLSearchParams({ redirectTo: path })}`, process.env.TEST_BASE_URL), {
      headers: recipient.headers,
      redirect: "manual",
    })
    assert.equal(signedIn.status, 302)
    assert.equal(signedIn.headers.get("location"), path)
    const invitePage = await fetch(new URL(path, process.env.TEST_BASE_URL), { headers: recipient.headers, redirect: "manual" })
    assert.equal(invitePage.status, 302)
    assert.equal(invitePage.headers.get("location"), `/?${new URLSearchParams({ joinInvitation: invitation.id })}`)
    const dashboard = await fetch(new URL(invitePage.headers.get("location")!, process.env.TEST_BASE_URL), { headers: recipient.headers, redirect: "manual" })
    assert.equal(dashboard.status, 200)
    assert.equal(await prisma.member.count({ where: { organizationId: organization.id } }), 1)
    console.info("PASS HTTP login round trip and dashboard access while joining")
  }
  await prisma.user.update({ where: { id: recipient.user.id }, data: { emailVerified: false } })
  assert.equal((await (await caller(recipient.headers)).team.acceptInvitation(input)).error, "unverified")
  await prisma.user.update({ where: { id: recipient.user.id }, data: { emailVerified: true } })
  assert.equal((await otherCaller.team.acceptInvitation(input)).error, "wrongAccount")
  assert.equal(await prisma.member.count({ where: { organizationId: organization.id } }), 1)
  assert.equal((await recipientCaller.team.acceptInvitation({ invitationId: "missing" })).error, "unavailable")
  await prisma.invitation.update({ where: { id: invitation.id }, data: { expiresAt: new Date(0) } })
  assert.equal((await recipientCaller.team.acceptInvitation(input)).error, "unavailable")
  assert.equal((await ownerCaller.team.list()).invitations.length, 0)
  await prisma.invitation.update({ where: { id: invitation.id }, data: { expiresAt: new Date(Date.now() + 86_400_000), status: "canceled" } })
  assert.equal((await recipientCaller.team.acceptInvitation(input)).error, "unavailable")
  await prisma.invitation.update({ where: { id: invitation.id }, data: { status: "pending" } })
  console.info("PASS wrong account, missing, expired, and canceled invitations")

  const accepted = await recipientCaller.team.acceptInvitation(input)
  assert.equal(accepted.organizationName, organization.name)
  assert.equal((await recipientCaller.team.acceptInvitation(input)).organizationName, organization.name)
  assert.equal(await prisma.member.count({ where: { organizationId: organization.id, userId: recipient.user.id } }), 1)
  assert.equal((await auth.api.getSession({ headers: recipient.headers }))?.session.activeOrganizationId, organization.id)
  assert.equal((await ownerCaller.team.list()).invitations.length, 0)
  const joinedCaller = await caller(recipient.headers)
  assert.equal((await joinedCaller.team.list()).canInvite, false)
  await assert.rejects(joinedCaller.team.invite({ name: "Invitee", email: emails[2] }), { code: "FORBIDDEN" })
  console.info("PASS acceptance, repeat visit, active organization, member invite permissions")

  const previousOrganization = await prisma.organization.create({
    data: {
      name: `Previous organization ${suffix}`,
      slug: `previous-test-${suffix}`,
      createdAt: new Date(),
      members: { create: { userId: recipient.user.id, role: "owner", createdAt: new Date() } },
    },
  })
  orgIds.push(previousOrganization.id)
  await prisma.session.updateMany({ where: { userId: recipient.user.id }, data: { activeOrganizationId: previousOrganization.id } })
  const switchedCaller = await caller(recipient.headers)
  assert.equal((await switchedCaller.team.list()).members.length, 1)
  await assert.rejects(switchedCaller.organizations.setActive({ organizationId: "missing" }), { code: "FORBIDDEN" })
  await switchedCaller.organizations.setActive({ organizationId: organization.id })
  assert.equal((await auth.api.getSession({ headers: recipient.headers }))?.session.activeOrganizationId, organization.id)
  await switchedCaller.organizations.setActive({ organizationId: previousOrganization.id })
  assert.equal((await auth.api.getSession({ headers: recipient.headers }))?.session.activeOrganizationId, previousOrganization.id)
  console.info("PASS business switch selects memberships and rejects non-members")
  await switchedCaller.team.acceptInvitation(input)
  assert.equal((await auth.api.getSession({ headers: recipient.headers }))?.session.activeOrganizationId, organization.id)
  assert.equal((await (await caller(recipient.headers)).team.list()).members.length, 2)
  console.info("PASS acceptance switches from another organization")

  await prisma.member.deleteMany({ where: { organizationId: organization.id, userId: recipient.user.id } })
  assert.equal((await recipientCaller.team.acceptInvitation(input)).error, "unavailable")
  assert.equal(await prisma.member.count({ where: { organizationId: organization.id, userId: recipient.user.id } }), 0)
  console.info("PASS accepted links cannot restore removed members")
} finally {
  try {
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
    await prisma.user.deleteMany({ where: { email: { in: emails } } })
    await prisma.verification.deleteMany({ where: { OR: emails.map((email) => ({ identifier: { contains: email } })) } })
  } finally {
    await prisma.$disconnect()
    await vite.close()
  }
}
