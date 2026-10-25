import { createResourceLimits } from "../resource-limits/service"
import { queuedEmailContent } from "./email-queue"
import { hasOrganizationPermission } from "~/lib/auth/permissions"
import { TRPCError } from "@trpc/server"
import type { z } from "~/lib/validation/zod"
import type { addPersonSchema, updatePersonSchema } from "~/lib/schemas/team"
import type { PrismaClient } from "../../../generated/prisma/client"
import { createInvitationEmailTemplate } from "~/lib/email-templates/invitation"
import { generateId } from "~/lib/database/id"
import { notFound, schedulingLock, type Database } from "./scheduling"
import { currentScheduleDate } from "~/lib/calendar/availability"
import { saveStaffSchedule } from "./staff-schedule"

const staffInclude = (organizationId: string) => ({
  staffServices: { where: { service: { organizationId, deletedAt: null } }, include: { service: { select: { id: true, name: true, color: true, durationMinutes: true, deliveryType: true, isActive: true, price: true, currency: true, description: true } } } },
  staffLocations: { where: { location: { organizationId } }, include: { location: { select: { id: true, name: true } } } },
} as const)
const memberSelect = { id: true, role: true, createdAt: true, userId: true, user: { select: { id: true, name: true, email: true, image: true } } } as const
export async function teamData(db: Database, organizationId: string, userId: string) {
  const member = await db.member.findFirst({ where: { organizationId, userId }, select: { role: true } })
  if (!member) throw new TRPCError({ code: "FORBIDDEN" })
  const members = await db.member.findMany({ where: { organizationId }, select: memberSelect, orderBy: { createdAt: "asc" } })
  const staff = await db.staffMember.findMany({ where: { organizationId }, include: staffInclude(organizationId), orderBy: { name: "asc" } })
  const invitations = await db.invitation.findMany({ where: { organizationId, status: "pending", expiresAt: { gt: new Date() } }, select: { id: true, email: true, inviteeName: true, role: true, expiresAt: true, staffMemberId: true }, orderBy: { createdAt: "desc" } })
  const toPerson = (profile: typeof staff[number] | null, account: typeof members[number] | null) => ({
    id: profile?.id ?? account!.id,
    name: profile?.name ?? (account!.user.name || account!.user.email),
    email: profile?.email ?? account?.user.email ?? null,
    phone: profile?.phone ?? null,
    image: profile?.image ?? account?.user.image ?? null,
    member: account,
    staff: profile,
    invitation: profile ? invitations.find((invite) => invite.staffMemberId === profile.id) ?? null : null,
  })
  const people = [
    ...members.map((account) => toPerson(staff.find((profile) => profile.memberId === account.id) ?? null, account)),
    ...staff.filter((profile) => !profile.memberId).map((profile) => toPerson(profile, null)),
  ].sort((a, b) => a.name.localeCompare(b.name))
  return { members, invitations, people, canInvite: hasOrganizationPermission(member.role, { invitation: ["create"] }) }
}
export type TeamPerson = Awaited<ReturnType<typeof teamData>>["people"][number]

export async function personData(db: Database, organizationId: string, id: string) {
  let staff = await db.staffMember.findFirst({ where: { organizationId, id }, include: staffInclude(organizationId) })
  const member = await db.member.findFirst({ where: { organizationId, id: staff?.memberId ?? id }, select: memberSelect })
  if (!staff && !member) notFound()
  if (!staff && member) staff = await db.staffMember.findFirst({ where: { organizationId, memberId: member.id }, include: staffInclude(organizationId) })
  const invitation = staff ? await db.invitation.findFirst({ where: { organizationId, staffMemberId: staff.id, status: "pending", expiresAt: { gt: new Date() } }, select: { id: true, email: true, inviteeName: true, role: true, expiresAt: true, staffMemberId: true } }) : null
  return { id: staff?.id ?? member!.id, name: staff?.name ?? (member!.user.name || member!.user.email), email: staff?.email ?? member?.user.email ?? null, phone: staff?.phone ?? null, image: staff?.image ?? member?.user.image ?? null, member, staff, invitation }
}

function emailConflict(code: "alreadyMember" | "alreadyInvited" | "alreadyStaff" | "alreadyLinked"): never {
  throw new TRPCError({ code: "CONFLICT", message: code, cause: Object.assign(new Error(code), { appCode: code }) })
}
async function validateAssignments(tx: Database, organizationId: string, serviceIds: string[], locationIds: string[]) {
  if (await tx.service.count({ where: { organizationId, deletedAt: null, id: { in: serviceIds } } }) !== serviceIds.length) notFound()
  if (await tx.location.count({ where: { organizationId, id: { in: locationIds } } }) !== locationIds.length) notFound()
}

export async function createPerson(db: PrismaClient, organizationId: string, actorUserId: string, input: z.infer<typeof addPersonSchema>, origin: string, locale: "en" | "fi") {
  return db.$transaction(async (tx) => {
    await schedulingLock(tx, organizationId)
    await validateAssignments(tx, organizationId, input.serviceIds, input.locationIds)
    const existingMember = input.email ? await tx.member.findFirst({ where: { organizationId, user: { email: { equals: input.email, mode: "insensitive" } } }, include: { staffProfile: true } }) : null
    if (existingMember && (!input.takesAppointments || existingMember.staffProfile)) emailConflict("alreadyMember")
    if (input.email && await tx.staffMember.findFirst({ where: { organizationId, email: { equals: input.email, mode: "insensitive" } } })) emailConflict("alreadyStaff")
    if (input.giveAppAccess && await tx.invitation.findFirst({ where: { organizationId, email: input.email, status: "pending", expiresAt: { gt: new Date() } } })) emailConflict("alreadyInvited")
    if (!existingMember) await createResourceLimits(tx).assert(organizationId, "teamMembers")
    const staff = input.takesAppointments ? await tx.staffMember.create({ data: {
      organizationId, name: input.name, email: input.email || null, phone: input.phone || null, bio: input.bio || null, timezone: input.timezone || null,
      memberId: existingMember?.id, acceptsAppointments: true, isActive: input.isActive,
      staffServices: { create: input.serviceIds.map((serviceId) => ({ serviceId })) }, staffLocations: { create: input.locationIds.map((locationId) => ({ locationId })) },
    } }) : null
    const invitation = input.giveAppAccess && !existingMember ? await createPersonInvitation(tx, organizationId, actorUserId, { ...input, staffMemberId: staff?.id }, origin, locale) : null
    return { personId: staff?.id ?? existingMember?.id ?? null, invitationId: invitation?.id ?? null, linked: Boolean(existingMember) }
  }, { timeout: 15000 })
}

export async function createPersonInvitation(tx: Database, organizationId: string, actorUserId: string, input: { name: string; email: string; role: "admin" | "member"; sendEmail: boolean; staffMemberId?: string }, origin: string, locale: "en" | "fi") {
  if (await tx.invitation.findFirst({ where: { organizationId, status: "pending", expiresAt: { gt: new Date() }, OR: [{ email: input.email }, ...(input.staffMemberId ? [{ staffMemberId: input.staffMemberId }] : [])] } })) emailConflict("alreadyInvited")
  if (await tx.invitation.count({ where: { organizationId, status: "pending", expiresAt: { gt: new Date() } } }) >= 100) throw new TRPCError({ code: "FORBIDDEN", message: "There are too many pending invitations" })
  if (!input.staffMemberId) await createResourceLimits(tx).assert(organizationId, "teamMembers")
  const organization = await tx.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { name: true } })
  const invitation = await tx.invitation.create({ data: { id: generateId(), organizationId, inviterId: actorUserId, inviteeName: input.name, email: input.email, role: input.role, staffMemberId: input.staffMemberId, status: "pending", expiresAt: new Date(Date.now() + 14 * 86400000) } })
  const inviteUrl = new URL(`/invite/${encodeURIComponent(invitation.id)}`, origin).toString()
  if (input.sendEmail) {
    const template = await createInvitationEmailTemplate({ organizationName: organization.name, inviteUrl, locale })
    await tx.notification.create({ data: { organizationId, kind: "CUSTOM", channel: "EMAIL", recipient: input.email, ...queuedEmailContent(template, locale, { invitationId: invitation.id }) } })
  }
  if (process.env.NODE_ENV === "development") {
    console.info(`[team] Invitation for ${input.email}: ${inviteUrl}`)
  }
  return invitation
}

export async function inviteStaff(db: PrismaClient, organizationId: string, actorUserId: string, input: { staffMemberId: string; name: string; email: string; role: "admin" | "member"; sendEmail: boolean }, origin: string, locale: "en" | "fi") {
  return db.$transaction(async (tx) => {
    await schedulingLock(tx, organizationId)
    const staff = await tx.staffMember.findFirst({ where: { id: input.staffMemberId, organizationId, isActive: true } })
    if (!staff) notFound()
    if (staff.memberId) emailConflict("alreadyLinked")
    if (staff.email && staff.email.toLowerCase() !== input.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Use the staff profile email address", cause: Object.assign(new Error("staffEmailMismatch"), { appCode: "staffEmailMismatch" }) })
    const member = await tx.member.findFirst({ where: { organizationId, user: { email: { equals: input.email, mode: "insensitive" } } }, include: { staffProfile: true } })
    if (member?.staffProfile) emailConflict("alreadyLinked")
    await tx.staffMember.update({ where: { id: staff.id, organizationId }, data: { email: input.email, ...(member ? { memberId: member.id } : {}) } })
    if (member) return { error: null, id: null, linked: true }
    const invitation = await createPersonInvitation(tx, organizationId, actorUserId, input, origin, locale)
    return { error: null, id: invitation.id, linked: false }
  }, { timeout: 15000 })
}

export async function updatePerson(db: PrismaClient, organizationId: string, input: z.infer<typeof updatePersonSchema>, options: { preserveActivation?: boolean; accountUserId?: string } = {}) {
  return db.$transaction(async (tx) => {
    await schedulingLock(tx, organizationId)
    const person = await personData(tx, organizationId, input.id)
    if (!person.staff && !input.takesAppointments && !options.accountUserId) throw new TRPCError({ code: "BAD_REQUEST", message: "Enable appointments to create a staff profile" })
    await validateAssignments(tx, organizationId, input.serviceIds, input.locationIds)
    const email = person.member?.user.email ?? input.email
    if (email && await tx.staffMember.findFirst({ where: { organizationId, id: { not: person.staff?.id }, email: { equals: email, mode: "insensitive" } } })) emailConflict("alreadyStaff")
    if (person.invitation && email !== person.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Cancel the pending invitation before changing the email address", cause: Object.assign(new Error("pendingInvitation"), { appCode: "pendingInvitation" }) })
    const data = { name: input.name, email: email || null, phone: input.phone || null, bio: input.bio || null, timezone: input.timezone || null, isActive: options.preserveActivation ? person.staff?.isActive ?? true : input.isActive, acceptsAppointments: input.takesAppointments }
    const staff = person.staff ? await tx.staffMember.update({ where: { id: person.staff.id, organizationId }, data }) : await tx.staffMember.create({ data: { ...data, organizationId, memberId: person.member!.id } })
    await tx.staffService.deleteMany({ where: { staffMemberId: staff.id, service: { deletedAt: null }, serviceId: { notIn: input.serviceIds } } })
    await tx.staffLocation.deleteMany({ where: { staffMemberId: staff.id, locationId: { notIn: input.locationIds } } })
    await tx.staffService.updateMany({ where: { staffMemberId: staff.id, serviceId: { in: input.serviceIds } }, data: { isActive: true } })
    await tx.staffLocation.updateMany({ where: { staffMemberId: staff.id, locationId: { in: input.locationIds } }, data: { isActive: true } })
    await tx.staffService.createMany({ data: input.serviceIds.map((serviceId) => ({ staffMemberId: staff.id, serviceId })), skipDuplicates: true })
    await tx.staffLocation.createMany({ data: input.locationIds.map((locationId) => ({ staffMemberId: staff.id, locationId })), skipDuplicates: true })
    if (input.workingHours !== undefined || input.breaks !== undefined) {
      const settings = await tx.organizationSettings.findUnique({ where: { organizationId } })
      const timezone = settings?.timezone ?? "Europe/Helsinki"
      const at = currentScheduleDate(timezone)
      for (const kind of ["workingHours", "breaks"] as const) {
        if (input[kind] === undefined) continue
        await saveStaffSchedule(tx, { organizationId, staffMemberId: staff.id, kind, replacement: input[kind], at, timezone })
      }
    }
    if (options.accountUserId) await tx.user.update({ where: { id: options.accountUserId }, data: { name: input.name } })
    return personData(tx, organizationId, staff.id)
  }, { timeout: 15000 })
}

// Used by Better Auth's acceptance hook and by safe repeat visits to the join page
export async function linkInvitationStaff(db: PrismaClient, invitationId: string, memberId: string) {
  await db.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({ where: { id: invitationId } })
    if (!invitation?.staffMemberId) return
    await schedulingLock(tx, invitation.organizationId)
    const member = await tx.member.findFirst({ where: { id: memberId, organizationId: invitation.organizationId, user: { emailVerified: true, email: { equals: invitation.email, mode: "insensitive" } } } })
    if (!member || invitation.status !== "accepted") throw new TRPCError({ code: "FORBIDDEN" })
    const existing = await tx.staffMember.findFirst({ where: { organizationId: invitation.organizationId, memberId } })
    if (existing && existing.id !== invitation.staffMemberId) emailConflict("alreadyLinked")
    const linked = await tx.staffMember.updateMany({ where: { id: invitation.staffMemberId, organizationId: invitation.organizationId, OR: [{ memberId: null }, { memberId }] }, data: { memberId } })
    if (!linked.count) emailConflict("alreadyLinked")
  })
}
