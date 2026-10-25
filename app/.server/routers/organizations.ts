import { communicationsSettingsSchema, readCommunicationsSettings } from "~/lib/schemas/communications"
import { appointmentSettingsInput as settingsInput } from "~/lib/schemas/organization"
import { refreshReminders } from "../services/notifications"
import { isManager, notFound } from "../services/scheduling"
import { schedulingLock } from "../services/scheduling"
import type { TRPCRouterRecord } from "@trpc/server"
import { TRPCError } from "@trpc/server"

import { permissionProcedure, organizationProcedure, protectedProcedure } from "../trpc"
import { throwIfForcedServerError } from "../forced-error"
import { generateId } from "~/lib/database/id"
import { organizationSettingsFormSchema } from "~/lib/schemas/organization"
import { bookingSettingsSchema, defaultBookingSettings } from "~/lib/schemas/booking-settings"
import { z } from "~/lib/validation/zod"

import { Temporal } from "@js-temporal/polyfill"
import { readBusinessExceptions, readHolidaySettings, upcomingBusinessHolidays } from "~/lib/business/business-holidays"
import { businessExceptionSchema, businessHolidaySchema, businessScheduleSchema } from "~/lib/schemas/business-schedule"

export const organizationsRouter = {
  communicationsSettings: permissionProcedure({ communications: ["configure"] }).query(async ({ ctx }) => {
    throwIfForcedServerError()
    return readCommunicationsSettings(await ctx.prisma.organizationSettings.findUnique({ where: { organizationId: ctx.organizationId } }))
  }),
  updateCommunicationsSettings: permissionProcedure({ communications: ["configure"] }).input(communicationsSettingsSchema.partial()).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    const current = await tx.organizationSettings.findUnique({ where: { organizationId: ctx.organizationId } })
    const data = { ...input, ...(input.senderName !== undefined ? { senderName: input.senderName || null } : {}), ...(input.replyToAddress !== undefined ? { replyToAddress: input.replyToAddress || null } : {}) }
    const saved = await tx.organizationSettings.upsert({ where: { organizationId: ctx.organizationId }, create: { organizationId: ctx.organizationId, ...data }, update: data })
    if ((input.enableAppointmentReminders !== undefined && input.enableAppointmentReminders !== (current?.enableAppointmentReminders ?? true)) || (input.reminderOffsetsMinutes !== undefined && JSON.stringify(input.reminderOffsetsMinutes) !== JSON.stringify(current?.reminderOffsetsMinutes ?? [1440]))) await refreshReminders(tx, ctx.organizationId)
    return readCommunicationsSettings(saved)
  }, { timeout: 30000 })),
  bookingSettings: permissionProcedure({ bookingSettings: ["configure"] }).query(async ({ ctx }) => {
    throwIfForcedServerError()
    const settings = await ctx.prisma.organizationSettings.findUnique({ where: { organizationId: ctx.organizationId } })
    return bookingSettingsSchema.parse(settings ?? defaultBookingSettings)
  }),
  updateBookingSettings: permissionProcedure({ bookingSettings: ["configure"] }).input(bookingSettingsSchema.partial()).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    const settings = await tx.organizationSettings.upsert({
      where: { organizationId: ctx.organizationId },
      create: { organizationId: ctx.organizationId, ...input },
      update: input,
    })
    return bookingSettingsSchema.parse(settings)
  })),
  saveBusinessException: permissionProcedure({ business: ["configure"], availability: ["manage"] }).input(businessExceptionSchema).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    const current = await tx.organizationSettings.findUnique({ where: { organizationId: ctx.organizationId } })
    const saved = readBusinessExceptions(current?.businessHolidays)
    if (saved.some((entry) => entry.id !== input.id && entry.date === input.date)) {
      throw new TRPCError({ code: "BAD_REQUEST", cause: new z.ZodError([{ code: "custom", path: ["date"], message: ctx.locale === "fi" ? "Tälle päivälle on jo poikkeus" : "There is already an exception on this date" }]) })
    }
    if (saved.length >= 100 && !saved.some((entry) => entry.id === input.id)) throw new TRPCError({ code: "BAD_REQUEST", cause: new z.ZodError([{ code: "custom", path: ["date"], message: ctx.locale === "fi" ? "Poista ensin vanha poikkeus" : "Remove an old exception first" }]) })
    const exceptions = [...saved.filter((entry) => entry.id !== input.id), input].sort((a, b) => a.date.localeCompare(b.date))
    const businessHolidays = { version: 2, holidays: readHolidaySettings(current?.businessHolidays), exceptions }
    await tx.organizationSettings.upsert({ where: { organizationId: ctx.organizationId }, create: { organizationId: ctx.organizationId, businessHolidays }, update: { businessHolidays } })
    return input
  })),
  removeBusinessException: permissionProcedure({ business: ["configure"], availability: ["manage"] }).input(z.object({ id: z.string().startsWith("exception-") })).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    const current = await tx.organizationSettings.findUnique({ where: { organizationId: ctx.organizationId } })
    const businessHolidays = { version: 2, holidays: readHolidaySettings(current?.businessHolidays), exceptions: readBusinessExceptions(current?.businessHolidays).filter((entry) => entry.id !== input.id) }
    await tx.organizationSettings.upsert({ where: { organizationId: ctx.organizationId }, create: { organizationId: ctx.organizationId, businessHolidays }, update: { businessHolidays } })
    return { id: input.id }
  })),
  saveCustomBusinessHoliday: permissionProcedure({ business: ["configure"], availability: ["manage"] })
    .input(businessHolidaySchema.refine((holiday) => holiday.id.startsWith("custom-"), { path: ["name"], message: "Default holidays cannot be changed here" }))
    .mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
      await schedulingLock(tx, ctx.organizationId)
      const current = await tx.organizationSettings.findUnique({ where: { organizationId: ctx.organizationId } })
      const saved = readHolidaySettings(current?.businessHolidays)
      const holidays = saved.some((holiday) => holiday.id === input.id)
        ? saved.map((holiday) => holiday.id === input.id ? input : holiday)
        : [...saved, input]
      const today = Temporal.Now.plainDateISO(current?.timezone ?? "Europe/Helsinki").toString()
      const upcoming = upcomingBusinessHolidays({ holidays }, today)
      const validation = businessScheduleSchema.safeParse({ workingHours: [], breaks: [], holidays: upcoming })
      if (!validation.success) {
        throw new TRPCError({ code: "BAD_REQUEST", cause: new z.ZodError(validation.error.issues.map((issue) => ({ ...issue, path: [issue.path.at(-1) === "date" ? "date" : "name"] }))) })
      }
      const businessHolidays = { version: 2, holidays, exceptions: readBusinessExceptions(current?.businessHolidays) }
      await tx.organizationSettings.upsert({ where: { organizationId: ctx.organizationId }, create: { organizationId: ctx.organizationId, businessHolidays }, update: { businessHolidays } })
      return upcoming.find((holiday) => holiday.id === input.id)!
    })),
  updateBusinessSchedule: permissionProcedure({ business: ["configure"], availability: ["manage"] }).input(businessScheduleSchema).mutation(({ ctx, input }) => ctx.prisma.$transaction(async (tx) => {
    await schedulingLock(tx, ctx.organizationId)
    const current = await tx.organizationSettings.findUnique({ where: { organizationId: ctx.organizationId } })
    const businessHolidays = { version: 2, holidays: input.holidays, exceptions: readBusinessExceptions(current?.businessHolidays) }
    const scope = { organizationId: ctx.organizationId, staffMemberId: null, locationId: null, isBreak: false }
    await tx.availabilityRule.deleteMany({ where: scope })
    if (input.workingHours.length) await tx.availabilityRule.createMany({ data: input.workingHours.map((rule) => ({ ...scope, ...rule, timezone: current?.timezone ?? "Europe/Helsinki" })) })
    await tx.organizationSettings.upsert({ where: { organizationId: ctx.organizationId }, create: { organizationId: ctx.organizationId, businessHolidays }, update: { businessHolidays } })
    return input
  })),
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
      create: { organizationId: ctx.organizationId, ...data, ...(country ? { countryCode: country } : {}) },
      update: { ...data, ...(country ? { countryCode: country } : {}) },
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
            countryCode: true,
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
      country: (organization.settings?.countryCode ?? "FI").toUpperCase(),
      currency: organization.settings?.currency ?? "EUR",
      location: (organization.settings?.countryCode ?? "fi").toLowerCase(),
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
          create: { id: generateId(), organizationId, currency: input.currency, countryCode: input.location.toUpperCase(), timezone: input.timezone, businessId: input.businessId, weekStartsOn: input.weekStartsOn },
          update: { currency: input.currency, countryCode: input.location.toUpperCase(), timezone: input.timezone, businessId: input.businessId, weekStartsOn: input.weekStartsOn },
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
  ctx: { prisma: typeof import("~/lib/database/prisma.server.ts").prisma; user: { id: string } },
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
