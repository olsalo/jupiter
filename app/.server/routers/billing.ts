import type { TRPCRouterRecord } from "@trpc/server"
import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { protectedProcedure } from "../trpc"
import {
  createOrganizationCancellationPortal,
  createOrganizationPaymentMethodPortal,
  getOrganizationNextCharge,
  listOrganizationInvoices,
  listOrganizationPaymentMethods,
  listOrganizationSubscriptions,
  setOrganizationDefaultPaymentMethod,
} from "~/lib/auth/server"
import { hasOrganizationPermission } from "~/lib/auth/permissions"
import { billingPlanSchema } from "~/lib/schemas/billing"
import { createReadOnlyBillingPortal, getBillingPlanState, saveBillingPlan } from "~/lib/billing/subscriptions.server"
import { isDemoMode } from "~/lib/billing/billing.server"

const billingProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const organizationId = requireOrganizationId(ctx.organizationId)
  const member = await ctx.prisma.member.findFirst({ where: { organizationId, userId: ctx.user.id }, select: { role: true } })
  if (!hasOrganizationPermission(member?.role, { billing: ["manage"] })) throw new TRPCError({ code: "FORBIDDEN" })
  return next({ ctx: { ...ctx, organizationId } })
})

function safeReturnUrl(value: string) {
  const url = new URL(value)
  if (url.origin !== new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:5175").origin) throw new TRPCError({ code: "BAD_REQUEST" })
  return url.href
}

export const billingRouter = {
  plan: billingProcedure.query(({ ctx }) => getBillingPlanState(ctx.organizationId)),
  bookableMembers: billingProcedure.query(({ ctx }) => ctx.prisma.staffMember.findMany({
    where: { organizationId: ctx.organizationId, isActive: true, acceptsAppointments: true },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  })),
  savePlan: billingProcedure.input(billingPlanSchema.and(z.object({ returnUrl: z.string().url(), cancelUrl: z.string().url(), locale: z.enum(["en", "fi"]) }))).mutation(({ ctx, input }) => {
    const demoMode = isDemoMode()
    return saveBillingPlan({ organizationId: ctx.organizationId, email: ctx.user.email, input, returnUrl: demoMode ? "" : safeReturnUrl(input.returnUrl), cancelUrl: demoMode ? "" : safeReturnUrl(input.cancelUrl), locale: input.locale })
  }),
  portal: billingProcedure.input(z.object({ returnUrl: z.string().url(), locale: z.enum(["en", "fi"]) })).mutation(({ ctx, input }) =>
    createReadOnlyBillingPortal(ctx.organizationId, safeReturnUrl(input.returnUrl), input.locale)),
  subscriptions: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = requireOrganizationId(ctx.organizationId)
    const member = await ctx.prisma.member.findFirst({
      select: { role: true },
      where: {
        organizationId,
        userId: ctx.user.id,
      },
    })

    if (!hasOrganizationPermission(member?.role, { billing: ["manage"] })) {
      throw new TRPCError({ code: "FORBIDDEN" })
    }

    return listOrganizationSubscriptions({ organizationId })
  }),

  nextCharge: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = requireOrganizationId(ctx.organizationId)
    const member = await ctx.prisma.member.findFirst({
      select: { role: true },
      where: {
        organizationId,
        userId: ctx.user.id,
      },
    })

    if (!hasOrganizationPermission(member?.role, { billing: ["manage"] })) {
      throw new TRPCError({ code: "FORBIDDEN" })
    }

    return getOrganizationNextCharge({ organizationId })
  }),

  paymentMethods: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = requireOrganizationId(ctx.organizationId)
    const member = await ctx.prisma.member.findFirst({
      select: { role: true },
      where: {
        organizationId,
        userId: ctx.user.id,
      },
    })

    if (!hasOrganizationPermission(member?.role, { billing: ["manage"] })) {
      throw new TRPCError({ code: "FORBIDDEN" })
    }

    return listOrganizationPaymentMethods({ organizationId })
  }),

  setDefaultPaymentMethod: protectedProcedure
    .input(z.object({ paymentMethodId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = requireOrganizationId(ctx.organizationId)
      const member = await ctx.prisma.member.findFirst({
        select: { role: true },
        where: {
          organizationId,
          userId: ctx.user.id,
        },
      })

      if (!hasOrganizationPermission(member?.role, { billing: ["manage"] })) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      try {
        const result = await setOrganizationDefaultPaymentMethod({
          organizationId,
          paymentMethodId: input.paymentMethodId,
        })

        if (!result) {
          throw new TRPCError({ code: "NOT_FOUND" })
        }

        return result
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        throw new TRPCError({
          cause: error,
          code: "BAD_REQUEST",
          message: "Unable to set the default payment method",
        })
      }
    }),

  invoices: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = requireOrganizationId(ctx.organizationId)
    const member = await ctx.prisma.member.findFirst({
      select: { role: true },
      where: {
        organizationId,
        userId: ctx.user.id,
      },
    })

    if (!hasOrganizationPermission(member?.role, { billing: ["manage"] })) {
      throw new TRPCError({ code: "FORBIDDEN" })
    }

    return listOrganizationInvoices({ organizationId })
  }),

  paymentMethodPortal: protectedProcedure
    .input(
      z.object({
        locale: z.enum(["en", "fi"]),
        returnUrl: z.string().url(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = requireOrganizationId(ctx.organizationId)
      const member = await ctx.prisma.member.findFirst({
        select: { role: true },
        where: {
          organizationId,
          userId: ctx.user.id,
        },
      })

      if (!hasOrganizationPermission(member?.role, { billing: ["manage"] })) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      const url = await createOrganizationPaymentMethodPortal({
        locale: input.locale,
        organizationId,
        returnUrl: input.returnUrl,
      })

      if (!url) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }

      return { url }
    }),

  cancellationPortal: protectedProcedure
    .input(
      z.object({
        locale: z.enum(["en", "fi"]),
        returnUrl: z.string().url(),
        subscriptionId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = requireOrganizationId(ctx.organizationId)
      const member = await ctx.prisma.member.findFirst({
        select: { role: true },
        where: {
          organizationId,
          userId: ctx.user.id,
        },
      })

      if (!hasOrganizationPermission(member?.role, { billing: ["manage"] })) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      const url = await createOrganizationCancellationPortal({
        locale: input.locale,
        organizationId,
        returnUrl: input.returnUrl,
        subscriptionId: input.subscriptionId,
      })

      if (!url) {
        throw new TRPCError({ code: "NOT_FOUND" })
      }

      return { url }
    }),
} satisfies TRPCRouterRecord

function requireOrganizationId(organizationId: string | null) {
  if (!organizationId) {
    throw new TRPCError({ code: "FORBIDDEN" })
  }

  return organizationId
}
