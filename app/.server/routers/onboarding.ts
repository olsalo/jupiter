import type { TRPCRouterRecord } from "@trpc/server"
import { TRPCError } from "@trpc/server"

import { protectedProcedure } from "../trpc"
import { auth, stripeBillingEnabled } from "~/lib/auth/server"
import { isOnboardingCountryCode } from "~/lib/countries"
import { isCurrencyCode } from "~/lib/currencies"
import { defaultTimeZone } from "~/lib/format-preference"
import { getIpLocationFromHeaders } from "~/lib/ip-location.server"
import { proPlan } from "~/lib/plans"
import { getStripePrice, getStripePriceId } from "~/lib/stripe.server"
import { generateId } from "~/lib/id"
import { onboardingFormSchema } from "~/lib/schemas/onboarding"

export const onboardingRouter = {
  status: protectedProcedure.query(async ({ ctx }) => {
    const membership = await ctx.prisma.member.findFirst({
      where: { userId: ctx.user.id },
      select: {
        organizationId: true,
        organization: {
          select: {
            settings: { select: { location: true, timezone: true } },
          },
        },
      },
    })
    const settings = membership?.organization.settings
    const subscription = membership
      ? await ctx.prisma.subscription.findFirst({
          select: { id: true },
          where: {
            referenceId: membership.organizationId,
            status: { in: ["active", "past_due", "trialing"] },
          },
        })
      : null

    return {
      billingEnabled: stripeBillingEnabled,
      businessComplete: Boolean(settings?.location && settings.timezone),
      subscriptionComplete: Boolean(subscription),
    }
  }),

  business: protectedProcedure.query(async ({ ctx }) => {
    const [membership, ipLocation] = await Promise.all([
      ctx.prisma.member.findFirst({
        where: { userId: ctx.user.id },
        select: {
          organization: {
            select: {
              name: true,
              settings: { select: { currency: true, location: true, timezone: true } },
            },
          },
        },
      }),
      getIpLocationFromHeaders(ctx.headers),
    ])
    const settings = membership?.organization.settings
    const ipCountry = ipLocation?.location.country?.toLowerCase()
    const ipCurrency = ipLocation?.location.currency?.find(isCurrencyCode)

    return {
      businessName: membership?.organization.name ?? "",
      currency: settings?.currency ?? ipCurrency ?? "EUR",
      location:
        settings?.location?.toLowerCase() ??
        (ipCountry && isOnboardingCountryCode(ipCountry) ? ipCountry : "fi"),
      name: ctx.user.name,
      timezone: settings?.timezone ?? ipLocation?.location.timezone ?? defaultTimeZone,
    }
  }),

  subscription: protectedProcedure.query(async ({ ctx }) => {
    const membership = await ctx.prisma.member.findFirst({
      where: { userId: ctx.user.id },
      select: { organizationId: true },
    })
    const locale = ctx.locale === "fi" ? "fi" : "en"
    const [month, year] = stripeBillingEnabled
      ? await Promise.all([
          getStripePrice(getStripePriceId(proPlan.id, "month")),
          getStripePrice(getStripePriceId(proPlan.id, "year")),
        ])
      : [null, null]

    return {
      billingEnabled: stripeBillingEnabled,
      organizationId: membership?.organizationId ?? null,
      plan: {
        features: proPlan.features[locale],
        id: proPlan.id,
        name: proPlan.name,
      },
      prices: { month, year },
      locale,
    }
  }),

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
            currency: input.currency,
            location: input.location.toUpperCase(),
            timezone: input.timezone,
          },
          update: {
            currency: input.currency,
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
