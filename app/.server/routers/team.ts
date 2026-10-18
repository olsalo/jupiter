import { createPerson, inviteStaff, linkInvitationStaff, personData, teamData, updatePerson } from "../services/team"
import { isManager } from "../services/scheduling"
import { TRPCError, type TRPCRouterRecord } from "@trpc/server"
import { APIError } from "better-auth/api"

import { adminProcedure, protectedProcedure, publicProcedure } from "../trpc"
import { auth } from "~/lib/auth/server"
import { addPersonSchema, updatePersonSchema, personIdSchema, memberRoleSchema, inviteFormSchema } from "~/lib/schemas/team"
import { z } from "~/lib/zod"

export const teamRouter = {
  invitationPreview: publicProcedure
    .input(z.object({ invitationId: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const invitation = await ctx.prisma.invitation.findFirst({
        where: {
          id: input.invitationId,
          status: "pending",
          expiresAt: { gt: new Date() },
        },
        select: {
          organization: { select: { name: true } },
          user: { select: { name: true } },
        },
      })

      if (!invitation) return null

      return {
        inviterName: invitation.user.name.trim().split(/\s+/)[0] || invitation.user.name,
        organizationName: invitation.organization.name,
      }
    }),

  count: adminProcedure.query(async ({ ctx }) => {
    if (!ctx.organizationId) {
      throw new TRPCError({ code: "FORBIDDEN" })
    }

    const [members, invitations] = await Promise.all([
      ctx.prisma.member.count({
        where: { organizationId: ctx.organizationId },
      }),
      ctx.prisma.invitation.count({
        where: {
          organizationId: ctx.organizationId,
          status: "pending",
          expiresAt: { gt: new Date() },
        },
      }),
    ])

    const staffOnly = await ctx.prisma.staffMember.count({ where: { organizationId: ctx.organizationId, memberId: null } })
    return { members, invitations, people: members + staffOnly }
  }),

  list: adminProcedure.query(({ ctx }) => {
    if (!ctx.organizationId) throw new TRPCError({ code: "FORBIDDEN" })
    return teamData(ctx.prisma, ctx.organizationId, ctx.user.id)
  }),
  getPerson: adminProcedure.input(personIdSchema).query(async ({ ctx, input }) => {
    if (!ctx.organizationId) throw new TRPCError({ code: "FORBIDDEN" })
    const member = await ctx.prisma.member.findFirst({ where: { organizationId: ctx.organizationId, userId: ctx.user.id } })
    if (!member) throw new TRPCError({ code: "FORBIDDEN" })
    return personData(ctx.prisma, ctx.organizationId, input.id)
  }),
  addPerson: adminProcedure.input(addPersonSchema).mutation(({ ctx, input }) =>
    createPerson(ctx.prisma, ctx.organizationId, ctx.user.id, input, process.env.BETTER_AUTH_URL ?? "http://localhost:5175", ctx.locale)),
  updatePerson: adminProcedure.input(updatePersonSchema).mutation(({ ctx, input }) => updatePerson(ctx.prisma, ctx.organizationId, input)),
  setRole: adminProcedure.input(memberRoleSchema).mutation(async ({ ctx, input }) => {
    const target = await ctx.prisma.member.findFirst({ where: { id: input.memberId, organizationId: ctx.organizationId } })
    if (!target || target.userId === ctx.user.id || target.role.split(",").some((role) => role.trim() === "owner")) throw new TRPCError({ code: "FORBIDDEN" })
    await auth.api.updateMemberRole({ headers: ctx.headers, body: { memberId: input.memberId, organizationId: ctx.organizationId, role: input.role } })
    return { id: target.id }
  }),

  invite: adminProcedure.input(inviteFormSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.organizationId) {
      throw new TRPCError({ code: "FORBIDDEN" })
    }

    if (input.staffMemberId) {
      const member = await ctx.prisma.member.findFirst({ where: { organizationId: ctx.organizationId, userId: ctx.user.id } })
      if (!member || !isManager(member)) throw new TRPCError({ code: "FORBIDDEN" })
      return inviteStaff(ctx.prisma, ctx.organizationId, ctx.user.id, { ...input, staffMemberId: input.staffMemberId }, process.env.BETTER_AUTH_URL ?? "http://localhost:5175", ctx.locale)
    }
    try {
      // Better Auth checks the sender's membership and invitation permissions.
      const { name, sendEmail, ...invitationInput } = input
      const invitationHeaders = new Headers(ctx.headers)
      invitationHeaders.set("x-send-invitation-email", sendEmail ? "true" : "false")
      const invitation = await auth.api.createInvitation({
        headers: invitationHeaders,
        request: new Request(
          ctx.request?.url ?? process.env.BETTER_AUTH_URL ?? "http://localhost:5174",
          { headers: invitationHeaders },
        ),
        asResponse: false,
        body: { ...invitationInput, organizationId: ctx.organizationId },
      })

      await ctx.prisma.invitation.update({
        where: { id: invitation.id },
        data: { inviteeName: name },
      })

      return { error: null, id: invitation.id, linked: false }
    } catch (error) {
      if (error instanceof APIError) {
        if (error.body?.code === "USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION") {
          return { error: "alreadyMember" as const, id: null }
        }
        if (error.body?.code === "USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION") {
          return { error: "alreadyInvited" as const, id: null }
        }
        if (error.statusCode === 403) {
          throw new TRPCError({ code: "FORBIDDEN", cause: error })
        }
      }
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: error })
    }
  }),

  cancelInvitation: adminProcedure
    .input(z.object({ invitationId: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      const invitation = await ctx.prisma.invitation.findFirst({
        where: {
          id: input.invitationId,
          organizationId: ctx.organizationId,
          status: "pending",
        },
        select: { id: true },
      })

      if (!invitation) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }

      try {
        await auth.api.cancelInvitation({
          headers: ctx.headers,
          body: { invitationId: invitation.id },
        })
      } catch (error) {
        if (error instanceof APIError && error.statusCode === 403) {
          throw new TRPCError({ code: "FORBIDDEN", cause: error })
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: error })
      }

      return { id: invitation.id }
    }),

  removeMember: adminProcedure
    .input(z.object({ memberId: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.organizationId) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      const member = await ctx.prisma.member.findFirst({
        where: { id: input.memberId, organizationId: ctx.organizationId },
        select: { id: true, userId: true },
      })

      if (!member) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }
      if (member.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST" })
      }

      try {
        await auth.api.removeMember({
          headers: ctx.headers,
          body: {
            memberIdOrEmail: member.id,
            organizationId: ctx.organizationId,
          },
        })
      } catch (error) {
        if (error instanceof APIError) {
          if (error.statusCode === 403) {
            throw new TRPCError({ code: "FORBIDDEN", cause: error })
          }
          if (error.statusCode < 500) {
            throw new TRPCError({ code: "BAD_REQUEST", cause: error })
          }
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: error })
      }

      return { id: member.id }
    }),

  acceptInvitation: protectedProcedure
    .input(z.object({ invitationId: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.prisma.invitation.findUnique({
        where: { id: input.invitationId },
        include: { organization: { select: { name: true } } },
      })

      if (!invitation) {
        return { error: "unavailable" as const, organizationName: null }
      }
      if (invitation.email.toLowerCase() !== ctx.user.email.toLowerCase()) {
        return { error: "wrongAccount" as const, organizationName: null }
      }
      if (!ctx.user.emailVerified) {
        return { error: "unverified" as const, organizationName: null }
      }

      const membership = await ctx.prisma.member.findFirst({
        where: { organizationId: invitation.organizationId, userId: ctx.user.id },
      })

      // Reopening an accepted link is safe, but never restores a removed member.
      if (invitation.status !== "accepted" || !membership) {
        if (invitation.status !== "pending" || invitation.expiresAt <= new Date()) {
          return { error: "unavailable" as const, organizationName: null }
        }

        if (membership) {
          const updated = await ctx.prisma.invitation.updateMany({
            where: { id: invitation.id, status: "pending", expiresAt: { gt: new Date() } },
            data: { status: "accepted" },
          })
          if (!updated.count) {
            return { error: "unavailable" as const, organizationName: null }
          }
        } else {
          try {
            await auth.api.acceptInvitation({ headers: ctx.headers, body: input })
          } catch (error) {
            // A second tab or a retried request may have accepted the same link.
            const accepted = await ctx.prisma.invitation.findFirst({
              where: {
                id: invitation.id,
                status: "accepted",
                organization: { members: { some: { userId: ctx.user.id } } },
              },
            })
            if (!accepted) {
              if (error instanceof APIError && error.statusCode < 500) {
                return { error: "unavailable" as const, organizationName: null }
              }
              throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: error })
            }
          }
        }
      }

      const acceptedMember = await ctx.prisma.member.findFirst({ where: { organizationId: invitation.organizationId, userId: ctx.user.id } })
      if (acceptedMember) await linkInvitationStaff(ctx.prisma, invitation.id, acceptedMember.id)

      if (ctx.user.createdAt >= invitation.createdAt && invitation.inviteeName) {
        await ctx.prisma.user.update({
          where: { id: ctx.user.id },
          data: { name: invitation.inviteeName },
        })
      }

      // Sessions are database-backed, matching the active-organization middleware.
      await ctx.prisma.session.update({
        where: { id: ctx.session!.id },
        data: { activeOrganizationId: invitation.organizationId },
      })

      return { error: null, organizationName: invitation.organization.name }
    }),
} satisfies TRPCRouterRecord
