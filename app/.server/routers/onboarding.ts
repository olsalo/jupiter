import type { TRPCRouterRecord } from "@trpc/server"
import { TRPCError } from "@trpc/server"

import { z } from "~/lib/validation/zod"
import { Temporal } from "@js-temporal/polyfill"
import { businessScheduleSchema } from "~/lib/schemas/business-schedule"
import { upcomingBusinessHolidays } from "~/lib/business/business-holidays"
import { schedulingLock } from "../services/scheduling"
import { protectedProcedure } from "../trpc"
import { auth, stripeBillingEnabled } from "~/lib/auth/server"
import { isOnboardingCountryCode } from "~/lib/localization/countries"
import { isCurrencyCode } from "~/lib/localization/currencies"
import { defaultTimeZone } from "~/lib/localization/format-preference"
import { getIpLocationFromHeaders } from "~/lib/localization/ip-location.server.ts"
import { proPlan } from "~/lib/billing/plans"
import { getStripePrice, getStripePriceId } from "~/lib/billing/stripe.server.ts"
import { generateId } from "~/lib/database/id"
import { onboardingFormSchema } from "~/lib/schemas/onboarding"

const demoOnboardingPaymentBypassEnabled =
  process.env.DEMO_BYPASS_ONBOARDING_PAYMENT === "true"

export const onboardingRouter = {
  status: protectedProcedure.query(async ({ ctx }) => {
    const membership = await ctx.prisma.member.findFirst({
      where: { userId: ctx.user.id, ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}) },
      select: {
        organizationId: true,
        organization: {
          select: {
            settings: { select: { countryCode: true, timezone: true, onboardingStep: true } },
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
      billingEnabled: stripeBillingEnabled || demoOnboardingPaymentBypassEnabled,
      businessComplete: Boolean(settings?.countryCode && settings.timezone),
      availabilityComplete: Boolean(settings && settings.onboardingStep !== "availability"),
      holidaysComplete: Boolean(settings && !settings.onboardingStep),
      setupComplete: Boolean(settings?.countryCode && settings.timezone && !settings.onboardingStep),
      demoOnboardingPaymentBypassEnabled,
      subscriptionComplete: Boolean(subscription),
    }
  }),

  business: protectedProcedure.query(async ({ ctx }) => {
    const [membership, ipLocation] = await Promise.all([
      ctx.prisma.member.findFirst({
        where: { userId: ctx.user.id, ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}) },
        select: {
          organization: {
            select: {
              name: true,
              settings: { select: { currency: true, countryCode: true, timezone: true } },
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
        settings?.countryCode?.toLowerCase() ??
        (ipCountry && isOnboardingCountryCode(ipCountry) ? ipCountry : "fi"),
      name: ctx.user.name,
      timezone: settings?.timezone ?? ipLocation?.location.timezone ?? defaultTimeZone,
    }
  }),

  subscription: protectedProcedure.query(async ({ ctx }) => {
    const membership = await ctx.prisma.member.findFirst({
      where: { userId: ctx.user.id, ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}) },
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
      demoOnboardingPaymentBypassEnabled,
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

  schedule: protectedProcedure.query(async ({ ctx }) => {
    const member = await ctx.prisma.member.findFirst({
      where: { userId: ctx.user.id, ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}) },
      include: { organization: { include: { settings: true } } },
    })
    if (!member || !member.role.split(",").includes("owner")) throw new TRPCError({ code: "FORBIDDEN" })
    const settings = member.organization.settings
    const timezone = settings?.timezone ?? defaultTimeZone
    const rules = await ctx.prisma.availabilityRule.findMany({ where: { organizationId: member.organizationId, staffMemberId: null, locationId: null, isBreak: false } })
    return {
      timezone,
      workingHours: rules.length ? rules.map(({ dayOfWeek, startMinute, endMinute, isActive }) => ({ dayOfWeek, startMinute, endMinute, isActive, timezone, validFrom: null, validUntil: null })) : [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startMinute: 480, endMinute: 1080, isActive: true, timezone, validFrom: null, validUntil: null })),
      breaks: [],
      holidays: upcomingBusinessHolidays(settings?.businessHolidays, Temporal.Now.plainDateISO(timezone).toString()),
    }
  }),

  saveAvailability: protectedProcedure.input(z.object({ workingHours: businessScheduleSchema.shape.workingHours, breaks: businessScheduleSchema.shape.breaks })).mutation(async ({ ctx, input }) => {
    return ctx.prisma.$transaction(async (tx) => {
      const member = await tx.member.findFirst({ where: { userId: ctx.user.id, ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}) }, include: { organization: { include: { settings: true } } } })
      if (!member || !member.role.split(",").includes("owner")) throw new TRPCError({ code: "FORBIDDEN" })
      await schedulingLock(tx, member.organizationId)
      const settings = await tx.organizationSettings.findUniqueOrThrow({ where: { organizationId: member.organizationId } })
      if (settings.onboardingStep !== "availability") throw new TRPCError({ code: "CONFLICT" })
      const scope = { organizationId: member.organizationId, staffMemberId: null, locationId: null, isBreak: false }
      await tx.availabilityRule.deleteMany({ where: scope })
      const rules = input.workingHours.length ? input.workingHours : [{ dayOfWeek: 1, startMinute: 480, endMinute: 1080, isActive: false }]
      await tx.availabilityRule.createMany({ data: rules.map((rule) => ({ ...scope, ...rule, timezone: settings.timezone, validFrom: null, validUntil: null })) })
      await tx.organizationSettings.update({ where: { organizationId: member.organizationId }, data: { onboardingStep: "holidays" } })
      return { success: true }
    })
  }),

  confirmHolidays: protectedProcedure.input(businessScheduleSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.$transaction(async (tx) => {
      const member = await tx.member.findFirst({ where: { userId: ctx.user.id, ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}) }, select: { organizationId: true, role: true } })
      if (!member || !member.role.split(",").includes("owner")) throw new TRPCError({ code: "FORBIDDEN" })
      await schedulingLock(tx, member.organizationId)
      const settings = await tx.organizationSettings.findUniqueOrThrow({ where: { organizationId: member.organizationId } })
      if (settings.onboardingStep !== "holidays") throw new TRPCError({ code: "CONFLICT" })
      await tx.organizationSettings.update({ where: { organizationId: member.organizationId }, data: { businessHolidays: { version: 2, holidays: input.holidays }, onboardingStep: null } })
      return { success: true }
    })
  }),

  complete: protectedProcedure
    .input(onboardingFormSchema)
    .mutation(async ({ ctx, input }) => {
      const existingMembership = await ctx.prisma.member.findFirst({
        select: { id: true, organizationId: true, role: true },
        where: { userId: ctx.user.id, ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}) },
      })

      if (existingMembership) {
        if (!existingMembership.role.split(",").includes("owner")) throw new TRPCError({ code: "FORBIDDEN" })
        const existingSettings = await ctx.prisma.organizationSettings.findUnique({
          select: { countryCode: true, timezone: true },
          where: { organizationId: existingMembership.organizationId },
        })

        if (
          existingSettings?.countryCode &&
          existingSettings.timezone &&
          !demoOnboardingPaymentBypassEnabled
        ) {
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
        if (existingMembership && demoOnboardingPaymentBypassEnabled) {
          await transaction.organization.update({
            data: { name: input.businessName },
            where: { id: organization.id },
          })
        }

        await schedulingLock(transaction, organization.id)
        const location = await transaction.location.findFirst({ where: { organizationId: organization.id }, orderBy: { createdAt: "asc" } })
          ?? await transaction.location.create({ data: { organizationId: organization.id, name: input.businessName, country: input.location.toUpperCase(), timezone: input.timezone } })
        const member = await transaction.member.findFirstOrThrow({ where: { organizationId: organization.id, userId: ctx.user.id } })
        await transaction.staffMember.upsert({
          where: { memberId: member.id },
          create: { organizationId: organization.id, memberId: member.id, name: input.name, email: ctx.user.email, staffLocations: { create: { locationId: location.id } } },
          update: { name: input.name },
        })
        await transaction.user.update({
          data: { name: input.name },
          where: { id: ctx.user.id },
        })
        await transaction.organizationSettings.upsert({
          create: {
            id: generateId(),
            organizationId: organization.id,
            onboardingStep: "availability",
            currency: input.currency,
            countryCode: input.location.toUpperCase(),
            timezone: input.timezone,
          },
          update: {
            onboardingStep: "availability",
            currency: input.currency,
            countryCode: input.location.toUpperCase(),
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
