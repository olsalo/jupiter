import type { TRPCRouterRecord } from "@trpc/server"

import { publicProcedure } from "../trpc"
import { getPublishedForm } from "../services/forms/public-form"
import { submitForm } from "../services/forms/form-submission"
import { z } from "~/lib/zod"
import { resources } from "~/locales"

export const publicFormsRouter = {
  get: publicProcedure.input(z.object({ id: z.string().min(1).max(200) })).query(({ ctx, input }) => getPublishedForm(ctx.prisma, input.id)),
  submit: publicProcedure.input(z.object({
    id: z.string().min(1).max(200),
    versionId: z.string().min(1).max(200),
    values: z.record(z.string().max(200), z.union([z.string().max(100000), z.array(z.string().max(100000)).max(101)])).refine((values) => Object.keys(values).length <= 1001),
  })).mutation(({ ctx, input }) => {
    const language = ctx.locale === "fi" ? "fi" : "en"
    const forms = resources[language].forms
    return submitForm(ctx.prisma, input, {
      required: forms.preview.required,
      other: forms.preview.otherRequired,
      email: forms.public.emailInvalid,
      duplicate: forms.public.duplicateEmail,
    })
  }),
} satisfies TRPCRouterRecord
