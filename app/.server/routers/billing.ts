import type { TRPCRouterRecord } from "@trpc/server"
import { TRPCError } from "@trpc/server"
import { z } from "zod"

import { protectedProcedure } from "../trpc"
import {
  changeOrganizationBillingInterval,
  createOrganizationCancellationPortal,
  createOrganizationPaymentMethodPortal,
  getOrganizationNextCharge,
  listOrganizationInvoices,
  listOrganizationPaymentMethods,
  listOrganizationSubscriptions,
  setOrganizationDefaultPaymentMethod,
} from "~/lib/auth/server"
import { hasOwnerRole } from "~/lib/utils"

export const billingRouter = {
  subscriptions: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = requireOrganizationId(ctx.organizationId)
    const member = await ctx.prisma.member.findFirst({
      select: { role: true },
      where: {
        organizationId,
        userId: ctx.user.id,
      },
    })

    if (!hasOwnerRole(member?.role)) {
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

    if (!hasOwnerRole(member?.role)) {
      throw new TRPCError({ code: "FORBIDDEN" })
    }

    return getOrganizationNextCharge({ organizationId })
  }),

  changeInterval: protectedProcedure
    .input(z.object({ interval: z.enum(["month", "year"]) }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = requireOrganizationId(ctx.organizationId)
      const member = await ctx.prisma.member.findFirst({
        select: { role: true },
        where: {
          organizationId,
          userId: ctx.user.id,
        },
      })

      if (!hasOwnerRole(member?.role)) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      try {
        const result = await changeOrganizationBillingInterval({
          interval: input.interval,
          organizationId,
        })

        if (!result) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "The subscription or requested Stripe price was not found",
          })
        }

        return result
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error
        }

        throw new TRPCError({
          cause: error,
          code: "BAD_REQUEST",
          message: "Unable to change the billing interval",
        })
      }
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

    if (!hasOwnerRole(member?.role)) {
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

      if (!hasOwnerRole(member?.role)) {
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

    if (!hasOwnerRole(member?.role)) {
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

      if (!hasOwnerRole(member?.role)) {
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

      if (!hasOwnerRole(member?.role)) {
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
