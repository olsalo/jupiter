import type { TRPCRouterRecord } from "@trpc/server"
import { TRPCError } from "@trpc/server"

import { protectedProcedure } from "../trpc"
import { getFormSettings, updateFormSettings } from "../services/forms/form-settings"
import { formIdInput } from "~/lib/forms/schemas/form-draft"
import { updateFormSettingsInput } from "~/lib/forms/schemas/form-settings"

export const formSettingsRouter = {
  get: protectedProcedure.input(formIdInput).query(({ ctx, input }) => {
    if (!ctx.organizationId) throw new TRPCError({ code: "FORBIDDEN" })
    return getFormSettings(ctx.prisma, ctx.organizationId, input.id)
  }),
  update: protectedProcedure.input(updateFormSettingsInput).mutation(({ ctx, input }) => {
    if (!ctx.organizationId) throw new TRPCError({ code: "FORBIDDEN" })
    return updateFormSettings(ctx.prisma, ctx.organizationId, input.id, input.settings)
  }),
} satisfies TRPCRouterRecord
