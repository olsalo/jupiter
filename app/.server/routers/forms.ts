import type { TRPCRouterRecord } from "@trpc/server"
import { TRPCError } from "@trpc/server"

import { protectedProcedure } from "../trpc"
import { formSettingsRouter } from "./form-settings"
import { formResponsesRouter } from "./form-responses"
import { createForm, duplicateForm, getEditorDraft, saveFormDraft } from "../services/forms/form-editor"
import { publishForm } from "../services/forms/form-publishing"
import { formIdInput, saveDraftInput } from "~/lib/forms/schemas/form-draft"
import { z } from "~/lib/zod"
import { defaultTimeZone } from "~/lib/format-preference"
import { getOverviewRange, getStartOfWeek } from "~/lib/overview-time"

const overviewInput = z.object({
  days: z.number().int().min(1).max(366).default(30),
  // Inclusive calendar date in the workspace timezone, defaulting to today.
  endDate: z.iso.date().optional(),
}).optional()

export const formsRouter = {
  settings: formSettingsRouter,
  responses: formResponsesRouter,
  overview: protectedProcedure.input(overviewInput).query(async ({ ctx, input }) => {
    if (!ctx.organizationId) throw new TRPCError({ code: "FORBIDDEN" })
    const now = new Date()
    const settings = await ctx.prisma.organizationSettings.findUnique({
      where: { organizationId: ctx.organizationId },
      select: { timezone: true },
    })
    const timeZone = settings?.timezone ?? defaultTimeZone
    const weekStart = getStartOfWeek(now, timeZone)
    const { days, start, end } = getOverviewRange(now, timeZone, input)
    const [forms, responses, thisWeek, dailyCounts, recentForms, recentResponses] = await Promise.all([
      ctx.prisma.form.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: "PUBLISHED",
          enabled: true,
          publishedVersion: { not: null },
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ closesAt: null }, { closesAt: { gt: now } }] },
          ],
        },
        select: { responseLimit: true, _count: { select: { submissions: true } } },
      }),
      ctx.prisma.formSubmission.count({ where: { form: { organizationId: ctx.organizationId } } }),
      ctx.prisma.formSubmission.count({
        where: { form: { organizationId: ctx.organizationId }, submittedAt: { gte: weekStart, lte: now } },
      }),
      ctx.prisma.$queryRaw<{ key: string, count: number }[]>`
        SELECT to_char((s."submittedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}, 'YYYY-MM-DD') AS key,
          COUNT(*)::integer AS count
        FROM form_submission s
        JOIN form f ON f.id = s."formId"
        WHERE f."organizationId" = ${ctx.organizationId}
          AND s."submittedAt" >= ${start}
          AND s."submittedAt" < ${end}
          AND s."submittedAt" <= ${now}
        GROUP BY 1
      `,
      ctx.prisma.form.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 5,
        select: {
          id: true, title: true, status: true, enabled: true, updatedAt: true,
          _count: { select: { submissions: true } },
        },
      }),
      ctx.prisma.formSubmission.findMany({
        where: { form: { organizationId: ctx.organizationId }, submittedAt: { lte: now } },
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        take: 5,
        select: {
          id: true, formId: true, respondentEmail: true, submittedAt: true,
          form: { select: { title: true } },
        },
      }),
    ])

    const countsByDay = new Map(dailyCounts.map(({ key, count }) => [key, count]))

    return {
      activeForms: forms.filter((form) => form.responseLimit === null || form._count.submissions < form.responseLimit).length,
      responses,
      thisWeek,
      dailySubmissions: days.map(({ key, ...day }) => ({ ...day, value: countsByDay.get(key) ?? 0 })),
      timeZone,
      range: { days: days.length, startDate: days[0].key, endDate: days[days.length - 1].key },
      recentForms,
      recentResponses,
    }
  }),
  count: protectedProcedure.query(({ ctx }) => {
    if (!ctx.organizationId) throw new TRPCError({ code: "FORBIDDEN" })
    return ctx.prisma.form.count({ where: { organizationId: ctx.organizationId } })
  }),
  list: protectedProcedure.query(({ ctx }) => {
    if (!ctx.organizationId) throw new TRPCError({ code: "FORBIDDEN" })
    return ctx.prisma.form.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, title: true, slug: true, status: true, enabled: true, updatedAt: true,
        publishedVersion: true, draftRevision: true,
        _count: { select: { submissions: true } },
      },
    })
  }),
  get: protectedProcedure.input(formIdInput).query(({ ctx, input }) => {
    if (!ctx.organizationId) throw new TRPCError({ code: "FORBIDDEN" })
    return getEditorDraft(ctx.prisma, input.id, ctx.organizationId)
  }),
  create: protectedProcedure.mutation(({ ctx }) => {
    if (!ctx.organizationId) throw new TRPCError({ code: "FORBIDDEN" })
    return createForm(ctx.prisma, ctx.organizationId, ctx.user.id)
  }),
  saveDraft: protectedProcedure.input(saveDraftInput).mutation(({ ctx, input }) => {
    if (!ctx.organizationId) throw new TRPCError({ code: "FORBIDDEN" })
    return saveFormDraft(ctx.prisma, ctx.organizationId, input)
  }),
  publish: protectedProcedure.input(formIdInput.extend({ revision: z.number().int().min(0) })).mutation(({ ctx, input }) => {
    if (!ctx.organizationId) throw new TRPCError({ code: "FORBIDDEN" })
    return publishForm(ctx.prisma, ctx.organizationId, input)
  }),
  duplicate: protectedProcedure.input(formIdInput).mutation(({ ctx, input }) => {
    if (!ctx.organizationId) throw new TRPCError({ code: "FORBIDDEN" })
    return duplicateForm(ctx.prisma, ctx.organizationId, ctx.user.id, input.id)
  }),
  delete: protectedProcedure.input(formIdInput).mutation(async ({ ctx, input }) => {
    if (!ctx.organizationId) throw new TRPCError({ code: "FORBIDDEN" })
    const result = await ctx.prisma.form.deleteMany({ where: { id: input.id, organizationId: ctx.organizationId } })
    if (!result.count) throw new TRPCError({ code: "NOT_FOUND" })
    return { id: input.id }
  }),
} satisfies TRPCRouterRecord
