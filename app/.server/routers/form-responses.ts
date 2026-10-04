import { TRPCError, type TRPCRouterRecord } from "@trpc/server"

import type { Prisma } from "../../../generated/prisma/client"

import { protectedProcedure } from "../trpc"
import { formIdInput } from "~/lib/forms/schemas/form-draft"
import { formSnapshotSchema } from "~/lib/forms/form-snapshot"
import { z } from "~/lib/zod"

type SubmissionDetail = {
  id: string
  formVersion: { snapshot: Prisma.JsonValue }
  answers: { itemId: string, value: Prisma.JsonValue }[]
}

function responseDetail(submission: SubmissionDetail) {
  const snapshot = formSnapshotSchema.parse(submission.formVersion.snapshot)
  const answers = new Map(submission.answers.map((answer) => [answer.itemId, answer.value]))
  return {
    id: submission.id,
    sections: [...snapshot.sections].sort((a, b) => a.sortOrder - b.sortOrder).map((section) => ({
      id: section.id,
      title: section.title,
      answers: [...section.items].sort((a, b) => a.sortOrder - b.sortOrder)
        .filter((item) => item.type !== "TEXT_BLOCK").map((item) => {
          const stored = answers.get(item.id)
          const withOther = stored !== null && typeof stored === "object" && !Array.isArray(stored) ? stored : null
          const value = withOther ? withOther.value : stored
          const values = value === null || value === undefined ? [] : Array.isArray(value) ? value : [value]
          return {
            id: item.id,
            label: item.label,
            values: values.map((value) => {
              const text = String(value)
              if (item.type !== "SINGLE_CHOICE" && item.type !== "MULTIPLE_CHOICE") return text
              if (text === `other:${item.id}` && typeof withOther?.other === "string") return withOther.other
              return item.options.find((option) => option.value === text)?.label ?? text
            }),
          }
        }),
    })).filter((section) => section.answers.length > 0),
  }
}

export const formResponsesRouter = {
  export: protectedProcedure.input(formIdInput).query(async ({ ctx, input }) => {
    if (!ctx.organizationId) throw new TRPCError({ code: "FORBIDDEN" })
    const form = await ctx.prisma.form.findFirst({
      where: { id: input.id, organizationId: ctx.organizationId },
      select: {
        title: true,
        submissions: {
          orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
          select: {
            id: true, respondentEmail: true, submittedAt: true,
            answers: { select: { itemId: true, value: true } },
            formVersion: { select: { snapshot: true } },
          },
        },
      },
    })
    if (!form) throw new TRPCError({ code: "NOT_FOUND" })
    return {
      title: form.title,
      responses: form.submissions.map((submission) => ({
        ...responseDetail(submission),
        respondentEmail: submission.respondentEmail,
        submittedAt: submission.submittedAt,
      })),
    }
  }),
  list: protectedProcedure.input(formIdInput).query(async ({ ctx, input }) => {
    if (!ctx.organizationId) throw new TRPCError({ code: "FORBIDDEN" })
    const form = await ctx.prisma.form.findFirst({
      where: { id: input.id, organizationId: ctx.organizationId },
      select: { submissions: {
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        select: { id: true, respondentEmail: true, submittedAt: true },
      } },
    })
    if (!form) throw new TRPCError({ code: "NOT_FOUND" })
    return form.submissions
  }),
  get: protectedProcedure.input(formIdInput.extend({ submissionId: z.string().min(1) })).query(async ({ ctx, input }) => {
    if (!ctx.organizationId) throw new TRPCError({ code: "FORBIDDEN" })
    const submission = await ctx.prisma.formSubmission.findFirst({
      where: { id: input.submissionId, formId: input.id, form: { organizationId: ctx.organizationId } },
      select: {
        id: true, respondentEmail: true, submittedAt: true,
        answers: { select: { itemId: true, value: true } },
        formVersion: { select: { snapshot: true } },
      },
    })
    if (!submission) throw new TRPCError({ code: "NOT_FOUND" })
    return responseDetail(submission)
  }),
} satisfies TRPCRouterRecord
