import type { TRPCRouterRecord } from "@trpc/server"

import { protectedProcedure, publicProcedure } from "../trpc"
import { profileFormSchema } from "~/lib/schemas/profile"
import { z } from "~/lib/zod"
import { localeCookie, themeCookie, formatPreferenceCookie } from "~/lib/cookies.server"
import { syncUserLocale } from "~/lib/locale.server"

export const profileRouter = {
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
