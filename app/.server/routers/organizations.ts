import { appointmentSettingsInput as settingsInput } from "~/lib/schemas/organization"
import { refreshReminders } from "../services/notifications"
import { isManager, notFound } from "../services/scheduling"
import { schedulingLock } from "../services/scheduling"
import type { TRPCRouterRecord } from "@trpc/server"
import { TRPCError } from "@trpc/server"

import { permissionProcedure, organizationProcedure, protectedProcedure } from "../trpc"
import { throwIfForcedServerError } from "../forced-error"
import { generateId } from "~/lib/id"
import { organizationSettingsFormSchema } from "~/lib/schemas/organization"
import { z } from "~/lib/zod"

export const organizationsRouter = {
  getCurrent: organizationProcedure.query(({ ctx }) => ({
    id: ctx.organization.id, name: ctx.organization.name, slug: ctx.organization.slug,
    settings: ctx.organization.settings, role: ctx.member.role, memberId: ctx.member.id,
  })),
  updateSettings: permissionProcedure({ business: ["configure"], bookingSettings: ["configure"], communications: ["configure"] }).input(settingsInput).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    const current = await tx.organizationSettings.findUnique({ where: { organizationId: ctx.organizationId } })
    const startHour = input.defaultStartHour ?? current?.defaultStartHour ?? 8
    const endHour = input.defaultEndHour ?? current?.defaultEndHour ?? 18
    if (startHour >= endHour) throw new TRPCError({ code: "BAD_REQUEST", cause: settingsInput.safeParse({ defaultStartHour: startHour, defaultEndHour: endHour }).error })
    if (input.defaultLocationId && !await tx.location.findFirst({ where: { id: input.defaultLocationId, organizationId: ctx.organizationId, isActive: true } })) notFound()
    if (input.defaultBookingPageId && !await tx.bookingPage.findFirst({ where: { id: input.defaultBookingPageId, organizationId: ctx.organizationId, isActive: true } })) notFound()
    const { businessName, country, ...data } = input
    if (businessName !== undefined) await tx.organization.update({ where: { id: ctx.organizationId }, data: { name: businessName } })
    const settings = await tx.organizationSettings.upsert({
      where: { organizationId: ctx.organizationId },
      create: { organizationId: ctx.organizationId, ...data, ...(country ? { location: country } : {}) },
      update: { ...data, ...(country ? { location: country } : {}) },
    })
    if (input.enableAppointmentReminders !== undefined || input.reminderOffsetsMinutes !== undefined) await refreshReminders(tx, ctx.organizationId)
    return settings
  }, { timeout: 30000 })),
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
            businessId: true,
            weekStartsOn: true,
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
    if (!member) throw new TRPCError({ code: "FORBIDDEN" })

    return {
      businessName: organization.name,
      businessId: organization.settings?.businessId ?? null,
      weekStartsOn: organization.settings?.weekStartsOn ?? 1,
      country: (organization.settings?.location ?? "FI").toUpperCase(),
      currency: organization.settings?.currency ?? "EUR",
      location: (organization.settings?.location ?? "fi").toLowerCase(),
      timezone: organization.settings?.timezone ?? "Europe/Helsinki",
      canManage: isManager(member),
    }
  }),

  updateGeneral: permissionProcedure({ business: ["configure"] })
    .input(organizationSettingsFormSchema)
    .mutation(async ({ ctx, input }) => {
      const organizationId = requireOrganizationId(ctx.organizationId)
      const member = await getMember(ctx, organizationId)

      if (!member || !isManager(member)) {
        throw new TRPCError({ code: "FORBIDDEN" })
      }

      await ctx.prisma.$transaction(async (tx) => {
        await schedulingLock(tx, organizationId)
        await tx.organization.update({ data: { name: input.businessName }, where: { id: organizationId } })
        await tx.organizationSettings.upsert({
          where: { organizationId },
          create: { id: generateId("orgset"), organizationId, currency: input.currency, location: input.location.toUpperCase(), timezone: input.timezone, businessId: input.businessId, weekStartsOn: input.weekStartsOn },
          update: { currency: input.currency, location: input.location.toUpperCase(), timezone: input.timezone, businessId: input.businessId, weekStartsOn: input.weekStartsOn },
        })
      })

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
