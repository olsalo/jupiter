import type { TRPCRouterRecord } from "@trpc/server"
import { TRPCError } from "@trpc/server"

import { localizationDefaults } from "~/lib/localization/defaults"
import { z } from "~/lib/validation/zod"
import { Temporal } from "@js-temporal/polyfill"
import { businessScheduleSchema, createBusinessScheduleSchema } from "~/lib/schemas/business-schedule"
import { readBusinessExceptions } from "~/lib/business/business-holidays"
import { upcomingBusinessHolidays } from "~/lib/business/business-holidays.server"
import { schedulingLock } from "../services/scheduling"
import { protectedProcedure } from "../trpc"
import { auth, stripeBillingEnabled } from "~/lib/auth/server"
import { hasActiveOrganizationSubscription } from "~/lib/billing/billing.server.ts"
import { getOnboardingBusinessDefaults } from "~/lib/onboarding/business-defaults"

import { getIpLocationFromHeaders } from "~/lib/localization/ip-location.server.ts"
import { plans } from "~/lib/billing/plans"
import { generateId } from "~/lib/database/id"
import { onboardingFormSchema, onboardingLocationSchema } from "~/lib/schemas/onboarding"

const demoOnboardingPaymentBypassEnabled =
  process.env.NODE_ENV !== "production" && process.env.DEMO_BYPASS_ONBOARDING_PAYMENT === "true"

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
    const subscription = membership ? await hasActiveOrganizationSubscription({ organizationId: membership.organizationId, db: ctx.prisma }) : false
    const previousSubscription = membership && !subscription && settings?.countryCode && settings.timezone && !settings.onboardingStep
      ? await ctx.prisma.subscription.findFirst({
          where: { referenceId: membership.organizationId, stripeSubscriptionId: { not: null }, OR: [{ periodStart: { not: null } }, { trialStart: { not: null } }] },
          select: { id: true },
        })
      : null

    return {
      billingEnabled: stripeBillingEnabled || demoOnboardingPaymentBypassEnabled,
      businessComplete: Boolean(settings?.countryCode && settings.timezone),
      locationComplete: Boolean(settings && settings.onboardingStep !== "location"),
      availabilityComplete: Boolean(settings && settings.onboardingStep !== "location" && settings.onboardingStep !== "availability"),
      holidaysComplete: Boolean(settings && !settings.onboardingStep),
      setupComplete: Boolean(settings?.countryCode && settings.timezone && !settings.onboardingStep),
      demoOnboardingPaymentBypassEnabled,
      subscriptionComplete: Boolean(subscription),
      previouslySubscribed: Boolean(previousSubscription),
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
    return getOnboardingBusinessDefaults({
      businessName: membership?.organization.name,
      ipLocation,
      name: ctx.user.name,
      settings: membership?.organization.settings,
    })
  }),

  location: protectedProcedure.query(async ({ ctx }) => {
    const member = await ctx.prisma.member.findFirst({
      where: { userId: ctx.user.id, ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}) },
      include: { organization: { include: { settings: true } } },
    })
    if (!member || !member.role.split(",").includes("owner")) throw new TRPCError({ code: "FORBIDDEN" })
    const location = await ctx.prisma.location.findFirst({ where: { organizationId: member.organizationId, isActive: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
    return {
      id: location?.id ?? null,
      name: location?.name ?? member.organization.name,
      addressLine1: location?.addressLine1 ?? "",
      addressLine2: location?.addressLine2 ?? "",
      postalCode: location?.postalCode ?? "",
      city: location?.city ?? "",
      country: (location?.country ?? member.organization.settings?.countryCode ?? "FI").toUpperCase(),
      phone: location?.phone ?? "",
      email: location?.email ?? "",
    }
  }),

  saveLocation: protectedProcedure.input(onboardingLocationSchema).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    const member = await tx.member.findFirst({ where: { userId: ctx.user.id, ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}) }, select: { id: true, organizationId: true, role: true } })
    if (!member || !member.role.split(",").includes("owner")) throw new TRPCError({ code: "FORBIDDEN" })
    await schedulingLock(tx, member.organizationId)
    const settings = await tx.organizationSettings.findUniqueOrThrow({ where: { organizationId: member.organizationId } })
    if (!settings.countryCode || !settings.timezone) throw new TRPCError({ code: "CONFLICT" })
    const current = await tx.location.findFirst({ where: { organizationId: member.organizationId, isActive: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
    const { id: _id, ...values } = input
    const data = { ...values, addressLine2: input.addressLine2 || null, phone: input.phone || null, email: input.email || null, timezone: settings.timezone }
    const location = current
      ? await tx.location.update({ where: { id: current.id }, data })
      : await tx.location.create({ data: { ...data, organizationId: member.organizationId } })
    const owner = await tx.staffMember.findUniqueOrThrow({ where: { memberId: member.id } })
    await tx.staffLocation.upsert({
      where: { staffMemberId_locationId: { staffMemberId: owner.id, locationId: location.id } },
      create: { staffMemberId: owner.id, locationId: location.id },
      update: { isActive: true },
    })
    // A retry or a revisit must not reset progress from a later step
    if (settings.onboardingStep === "location") {
      await tx.organizationSettings.update({ where: { organizationId: member.organizationId }, data: { onboardingStep: "availability" } })
    }
    return { success: true }
  })),

  subscription: protectedProcedure.query(async ({ ctx }) => {
    const membership = await ctx.prisma.member.findFirst({
      where: { userId: ctx.user.id, ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}) },
      select: { organizationId: true },
    })
    const locale = ctx.locale === "fi" ? "fi" : "en"
    const availablePlans = plans.map((plan) => ({ ...plan, features: plan.features[locale] }))

    return {
      billingEnabled: stripeBillingEnabled,
      demoOnboardingPaymentBypassEnabled,
      organizationId: membership?.organizationId ?? null,
      plans: availablePlans,
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
    const timezone = settings?.timezone ?? localizationDefaults.timezone
    const rules = await ctx.prisma.availabilityRule.findMany({ where: { organizationId: member.organizationId, staffMemberId: null, locationId: null, isBreak: false } })
    return {
      timezone,
      countryCode: settings?.countryCode ?? "",
      workingHours: rules.length ? rules.map(({ dayOfWeek, startMinute, endMinute, isActive }) => ({ dayOfWeek, startMinute, endMinute, isActive, timezone, validFrom: null, validUntil: null })) : [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startMinute: 540, endMinute: 1020, isActive: true, timezone, validFrom: null, validUntil: null })),
      breaks: [],
      holidays: upcomingBusinessHolidays(settings?.businessHolidays, Temporal.Now.plainDateISO(timezone).toString(), settings?.countryCode ?? undefined),
    }
  }),

  saveAvailability: protectedProcedure.input(z.object({ workingHours: businessScheduleSchema.shape.workingHours, breaks: businessScheduleSchema.shape.breaks })).mutation(async ({ ctx, input }) => {
    return ctx.prisma.$transaction(async (tx) => {
      const member = await tx.member.findFirst({ where: { userId: ctx.user.id, ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}) }, include: { organization: { include: { settings: true } } } })
      if (!member || !member.role.split(",").includes("owner")) throw new TRPCError({ code: "FORBIDDEN" })
      await schedulingLock(tx, member.organizationId)
      const settings = await tx.organizationSettings.findUniqueOrThrow({ where: { organizationId: member.organizationId } })
      if (!settings.countryCode || !settings.timezone || settings.onboardingStep === "location") throw new TRPCError({ code: "CONFLICT" })
      const scope = { organizationId: member.organizationId, staffMemberId: null, locationId: null, isBreak: false }
      await tx.availabilityRule.deleteMany({ where: scope })
      const rules = input.workingHours.length ? input.workingHours : [{ dayOfWeek: 1, startMinute: 540, endMinute: 1020, isActive: false }]
      await tx.availabilityRule.createMany({ data: rules.map((rule) => ({ ...scope, ...rule, timezone: settings.timezone, validFrom: null, validUntil: null })) })
      if (settings.onboardingStep === "availability") {
        await tx.organizationSettings.update({ where: { organizationId: member.organizationId }, data: { onboardingStep: "holidays" } })
      }
      return { success: true }
    })
  }),

  confirmHolidays: protectedProcedure.input(businessScheduleSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.$transaction(async (tx) => {
      const member = await tx.member.findFirst({ where: { userId: ctx.user.id, ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}) }, select: { organizationId: true, role: true } })
      if (!member || !member.role.split(",").includes("owner")) throw new TRPCError({ code: "FORBIDDEN" })
      await schedulingLock(tx, member.organizationId)
      const settings = await tx.organizationSettings.findUniqueOrThrow({ where: { organizationId: member.organizationId } })
      if (!settings.countryCode || !settings.timezone || settings.onboardingStep === "location" || settings.onboardingStep === "availability") throw new TRPCError({ code: "CONFLICT" })
      const suggested = upcomingBusinessHolidays(settings.businessHolidays, Temporal.Now.plainDateISO(settings.timezone).toString(), settings.countryCode ?? undefined)
      const validation = createBusinessScheduleSchema(suggested).safeParse(input)
      if (!validation.success) throw new TRPCError({ code: "BAD_REQUEST", cause: validation.error })
      await tx.organizationSettings.update({ where: { organizationId: member.organizationId }, data: { businessHolidays: { version: 2, holidays: input.holidays, exceptions: readBusinessExceptions(settings.businessHolidays) }, onboardingStep: null } })
      return { success: true }
    })
  }),

  complete: protectedProcedure
    .input(onboardingFormSchema)
    .mutation(async ({ ctx, input }) => {
      let existingMembership = await ctx.prisma.member.findFirst({
        select: { id: true, organizationId: true, role: true },
        where: { userId: ctx.user.id, ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}) },
      })

      if (existingMembership && !existingMembership.role.split(",").includes("owner")) throw new TRPCError({ code: "FORBIDDEN" })

      let organization: { id: string; name: string }
      if (existingMembership) {
        organization = { id: existingMembership.organizationId, name: input.businessName }
      } else {
        try {
          organization = await createOrganization({ businessName: input.businessName, headers: ctx.headers })
        } catch (error) {
          if (!(error instanceof TRPCError) || error.message !== "ORGANIZATION_NAME_TAKEN") throw error
          // A concurrent first-step save may have just created this user's business
          existingMembership = await ctx.prisma.member.findFirst({
            where: { userId: ctx.user.id, ...(ctx.organizationId ? { organizationId: ctx.organizationId } : {}), organization: { slug: toSlug(input.businessName) } },
            select: { id: true, organizationId: true, role: true },
          })
          if (!existingMembership?.role.split(",").includes("owner")) throw error
          organization = { id: existingMembership.organizationId, name: input.businessName }
        }
      }

      await ctx.prisma.$transaction(async (transaction) => {
        await schedulingLock(transaction, organization.id)
        const settings = await transaction.organizationSettings.findUnique({ where: { organizationId: organization.id } })
        const businessWasComplete = Boolean(settings?.countryCode && settings.timezone)
        if (existingMembership) {
          await transaction.organization.update({
            data: { name: input.businessName },
            where: { id: organization.id },
          })
        }

        const member = await transaction.member.findFirstOrThrow({ where: { organizationId: organization.id, userId: ctx.user.id } })
        await transaction.staffMember.upsert({
          where: { memberId: member.id },
          create: { organizationId: organization.id, memberId: member.id, name: input.name, email: ctx.user.email },
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
            onboardingStep: "location",
            currency: input.currency,
            countryCode: input.location.toUpperCase(),
            timezone: input.timezone,
          },
          update: {
            ...(!businessWasComplete ? { onboardingStep: "location" as const } : {}),
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
