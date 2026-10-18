import { canAccessAvailability } from "~/lib/auth/permissions"
import { TRPCError } from "@trpc/server"
import type { TRPCRouterRecord } from "@trpc/server"

import { organizationProcedure, protectedProcedure, publicProcedure } from "../trpc"
import { personData, updatePerson } from "../services/team"
import { addStaffTimeOff } from "../services/team-time-off"
import { timeOffSchema } from "~/lib/team-time-off"
import { updatePersonSchema } from "~/lib/schemas/team"
import { profileFormSchema } from "~/lib/schemas/profile"
import { z } from "~/lib/zod"
import { localeCookie, themeCookie, formatPreferenceCookie } from "~/lib/cookies.server"
import { syncUserLocale } from "~/lib/locale.server"
import { schedulingLock } from "../services/scheduling"

export const profileRouter = {
  getTeamProfile: organizationProcedure.query(async ({ ctx }) => {
    const person = await personData(ctx.prisma, ctx.organizationId, ctx.member.id)
    return { ...person, name: person.member?.user.name || person.name, email: person.member!.user.email }
  }),
  updateTeamProfile: organizationProcedure.input(updatePersonSchema.omit({ id: true, isActive: true, email: true })).mutation(({ ctx, input }) => {
    if ((input.workingHours !== undefined || input.breaks !== undefined) && !canAccessAvailability(ctx.member, ctx.member.staffProfile?.id)) throw new TRPCError({ code: "FORBIDDEN" })
    return updatePerson(ctx.prisma, ctx.organizationId, { ...input, email: ctx.user.email, id: ctx.member.staffProfile?.id ?? ctx.member.id, isActive: ctx.member.staffProfile?.isActive ?? true }, { preserveActivation: true, accountUserId: ctx.user.id })
  }),
  resetTeamWorkingHours: organizationProcedure.mutation(async ({ ctx }) => {
    const staffMemberId = ctx.member.staffProfile?.id
    if (!staffMemberId || !canAccessAvailability(ctx.member, staffMemberId)) throw new TRPCError({ code: "FORBIDDEN" })
    await ctx.prisma.$transaction(async (tx) => {
      await schedulingLock(tx, ctx.organizationId)
      await tx.availabilityRule.deleteMany({ where: { organizationId: ctx.organizationId, staffMemberId, locationId: null, isBreak: false } })
    })
    return { success: true }
  }),
  addTimeOff: organizationProcedure.input(timeOffSchema()).mutation(({ ctx, input }) => {
    if (!ctx.member.staffProfile || !canAccessAvailability(ctx.member, ctx.member.staffProfile.id)) throw new TRPCError({ code: "FORBIDDEN", message: "No linked staff profile" })
    return addStaffTimeOff(ctx.prisma, ctx.organizationId, ctx.member.staffProfile.id, input)
  }),
  updateLocale: publicProcedure
    .input(z.object({ locale: z.enum(["en", "fi"]) }))
    .mutation(async ({ ctx, input }) => {
      ctx.responseHeaders?.append("Set-Cookie", await localeCookie.serialize(input.locale))
      return input
    }),
  updateTheme: publicProcedure
    .input(z.object({ theme: z.enum(["light", "dark"]) }))
    .mutation(async ({ ctx, input }) => {
      ctx.responseHeaders?.append("Set-Cookie", await themeCookie.serialize(input.theme))
      return input
    }),
  updatePreferences: protectedProcedure
    .input(z.object({
      locale: z.enum(["en", "fi"]).optional(),
      theme: z.enum(["light", "dark"]).optional(),
      formatPreference: z.enum(["eu", "us"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.locale) {
        await syncUserLocale({ locale: input.locale, userId: ctx.user.id })
        ctx.responseHeaders?.append("Set-Cookie", await localeCookie.serialize(input.locale))
      }
      if (input.theme) ctx.responseHeaders?.append("Set-Cookie", await themeCookie.serialize(input.theme))
      if (input.formatPreference) ctx.responseHeaders?.append("Set-Cookie", await formatPreferenceCookie.serialize(input.formatPreference))
      return input
    }),
  updateName: protectedProcedure
    .input(profileFormSchema)
    .mutation(({ ctx, input }) =>
      ctx.prisma.user.update({
        data: { name: input.name },
        select: { name: true },
        where: { id: ctx.user.id },
      }),
    ),
} satisfies TRPCRouterRecord
