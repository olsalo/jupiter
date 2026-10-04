import type { TRPCRouterRecord } from "@trpc/server"
import { TRPCError } from "@trpc/server"

import { protectedProcedure } from "../trpc"
import { auth } from "~/lib/auth/server"
import { generateId } from "~/lib/id"
import { onboardingFormSchema } from "~/lib/schemas/onboarding"

export const onboardingRouter = {
  complete: protectedProcedure
    .input(onboardingFormSchema)
    .mutation(async ({ ctx, input }) => {
      const existingMembership = await ctx.prisma.member.findFirst({
        select: { id: true, organizationId: true },
        where: { userId: ctx.user.id },
      })

      if (existingMembership) {
        const existingSettings = await ctx.prisma.organizationSettings.findUnique({
          select: { location: true, timezone: true },
          where: { organizationId: existingMembership.organizationId },
        })

        if (existingSettings?.location && existingSettings.timezone) {
          throw new TRPCError({ code: "CONFLICT" })
        }
      }

      const organization = existingMembership
        ? { id: existingMembership.organizationId, name: input.businessName }
        : await createOrganization({
            businessName: input.businessName,
            headers: ctx.headers,
          })

      await ctx.prisma.$transaction(async (transaction) => {
        await transaction.user.update({
          data: { name: input.name },
          where: { id: ctx.user.id },
        })
        await transaction.organizationSettings.upsert({
          create: {
            id: generateId("orgset"),
            organizationId: organization.id,
            location: input.location.toUpperCase(),
            timezone: input.timezone,
          },
          update: {
            location: input.location.toUpperCase(),
            timezone: input.timezone,
          },
          where: { organizationId: organization.id },
        })
      })

      return {
        organizationId: organization.id,
      }
    }),
} satisfies TRPCRouterRecord

async function createOrganization({
  businessName,
  headers,
}: {
  businessName: string
  headers: Headers
}) {
  try {
    return await auth.api.createOrganization({
      body: {
        name: businessName,
        slug: toSlug(businessName),
      },
      headers,
    })
  } catch (error) {
    const errorCode = getBetterAuthErrorCode(error)

    if (
      errorCode === "ORGANIZATION_ALREADY_EXISTS" ||
      errorCode === "ORGANIZATION_SLUG_ALREADY_TAKEN"
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "ORGANIZATION_NAME_TAKEN",
      })
    }

    throw error
  }
}

function getBetterAuthErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("body" in error)) {
    return null
  }

  const body = error.body

  if (
    !body ||
    typeof body !== "object" ||
    !("code" in body) ||
    typeof body.code !== "string"
  ) {
    return null
  }

  return body.code
}

function toSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64)
}
