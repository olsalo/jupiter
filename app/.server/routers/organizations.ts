import type { TRPCRouterRecord } from "@trpc/server"
import { TRPCError } from "@trpc/server"

import { protectedProcedure } from "../trpc"
import { throwIfForcedServerError } from "../forced-error"
import { generateId } from "~/lib/id"
import { hasOwnerRole } from "~/lib/utils"
import { organizationSettingsFormSchema } from "~/lib/schemas/organization"
import { z } from "~/lib/zod"

export const organizationsRouter = {
  setActive: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const member = await getMember(ctx, input.organizationId)

      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      await ctx.prisma.session.update({
        where: { id: ctx.session!.id },
        data: { activeOrganizationId: input.organizationId },
      })

      return { organizationId: input.organizationId }
    }),

  general: protectedProcedure.query(async ({ ctx }) => {
    throwIfForcedServerError()

    const organizationId = requireOrganizationId(ctx.organizationId)
    const organization = await ctx.prisma.organization.findUnique({
      select: {
        name: true,
        settings: {
          select: {
            currency: true,
            location: true,
            timezone: true,
          },
        },
      },
      where: { id: organizationId },
    })

    if (!organization) {
      throw new TRPCError({ code: "NOT_FOUND" })
    }

    const member = await getMember(ctx, organizationId)

    return {
      businessName: organization.name,
      currency: organization.settings?.currency ?? "EUR",
      location: (organization.settings?.location ?? "fi").toLowerCase(),
      timezone: organization.settings?.timezone ?? "Europe/Helsinki",
      canManage: hasOwnerRole(member?.role),
    }
  }),

  updateGeneral: protectedProcedure
    .input(organizationSettingsFormSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = requireOrganizationId(ctx.organizationId)
      const member = await getMember(ctx, organizationId)

      if (!hasOwnerRole(member?.role)) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      await ctx.prisma.$transaction([
        ctx.prisma.organization.update({
          data: { name: input.businessName },
          where: { id: organizationId },
        }),
        ctx.prisma.organizationSettings.upsert({
          create: {
            id: generateId("orgset"),
            currency: input.currency,
            location: input.location,
            organizationId,
            timezone: input.timezone,
          },
          update: {
            currency: input.currency,
            location: input.location,
            timezone: input.timezone,
          },
          where: { organizationId },
        }),
      ])

      return input
    }),
} satisfies TRPCRouterRecord

function requireOrganizationId(organizationId: string | null) {
  if (!organizationId) {
    throw new TRPCError({ code: "FORBIDDEN" })
  }

  return organizationId
}

function getMember(
  ctx: { prisma: typeof import("~/lib/prisma.server").prisma; user: { id: string } },
  organizationId: string,
) {
  return ctx.prisma.member.findFirst({
    select: { role: true },
    where: {
      organizationId,
      userId: ctx.user.id,
    },
  })
}
