import { TRPCError, type TRPCRouterRecord } from "@trpc/server"
import { APIError } from "better-auth/api"

import { protectedProcedure, publicProcedure } from "../trpc"
import { auth } from "~/lib/auth/server"
import { inviteFormSchema } from "~/lib/schemas/team"
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

  count: protectedProcedure.query(async ({ ctx }) => {
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

    return { members, invitations }
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.organizationId) {
      throw new TRPCError({ code: "FORBIDDEN" })
    }

    const [members, invitations] = await Promise.all([
      ctx.prisma.member.findMany({
        where: { organizationId: ctx.organizationId },
        select: {
          id: true,
          role: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      ctx.prisma.invitation.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: "pending",
          expiresAt: { gt: new Date() },
        },
        select: { id: true, email: true, inviteeName: true, role: true, expiresAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ])
    const member = members.find((member) => member.user.id === ctx.user.id)

    if (!member) {
      throw new TRPCError({ code: "FORBIDDEN" })
    }

    return {
      members,
      invitations,
      canInvite: member.role.split(",").some((role) => ["owner", "admin"].includes(role.trim())),
    }
  }),

  invite: protectedProcedure.input(inviteFormSchema).mutation(async ({ ctx, input }) => {
    if (!ctx.organizationId) {
      throw new TRPCError({ code: "FORBIDDEN" })
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

      return { error: null, id: invitation.id }
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

  cancelInvitation: protectedProcedure
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
