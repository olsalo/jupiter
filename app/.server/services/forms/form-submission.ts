import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { Prisma } from "../../../../generated/prisma/client"
import { validateAvailability } from "./public-form"
import { applyLiveFormSettings, formRuntimeSettingsSelect } from "./form-runtime-settings"
import { formSnapshotSchema } from "~/lib/forms/form-snapshot"
import { createSubmissionSchema, defaultAnswerValues, otherName, otherValue } from "~/lib/forms/form-validation"
import { generateId } from "~/lib/id"
import type { prisma as client } from "~/lib/prisma.server"
import { notifyNewFormResponse } from "./response-notifications"

export async function submitForm(prisma: typeof client, input: {
  id: string
  versionId: string
  values: Record<string, string | string[]>
}, messages: { required: string, other: string, email: string, duplicate: string }) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Serialize final availability checks and commits, including concurrent limits.
      const locked = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM form WHERE id = ${input.id} FOR UPDATE`)
      if (!locked.length) throw new TRPCError({ code: "NOT_FOUND" })
      const form = await tx.form.findUniqueOrThrow({ where: { id: locked[0].id }, select: {
        ...formRuntimeSettingsSelect,
        id: true, enabled: true, status: true, publishedVersion: true, startsAt: true, closesAt: true, responseLimit: true,
        _count: { select: { submissions: true } },
      } })
      validateAvailability(form, form._count.submissions)
      const version = await tx.formVersion.findFirst({ where: { id: input.versionId, formId: form.id, version: { lte: form.publishedVersion! } } })
      // Earlier published versions remain valid for respondents already filling them.
      if (!version) throw new TRPCError({ code: "BAD_REQUEST" })
      const snapshot = applyLiveFormSettings(formSnapshotSchema.parse(version.snapshot), form)
      const emptyValues = Object.fromEntries(Object.entries(defaultAnswerValues(snapshot)).map(([key, value]) => [key, Array.isArray(value) ? [] : ""]))
      const result = createSubmissionSchema(snapshot, messages).safeParse({
        ...emptyValues,
        ...input.values,
        ...(snapshot.settings.emailCollection === "NONE" ? { respondentEmail: "" } : {}),
      })
      if (!result.success) throw new TRPCError({ code: "BAD_REQUEST", cause: result.error })
      const email = typeof result.data.respondentEmail === "string" ? result.data.respondentEmail || null : null
      const dedupeKey = snapshot.settings.limitOneResponsePerEmail ? email : null
      if (dedupeKey && await tx.formSubmission.findFirst({ where: { formId: form.id, respondentEmail: dedupeKey }, select: { id: true } })) {
        throw new TRPCError({ code: "BAD_REQUEST", cause: duplicateEmailError(messages.duplicate) })
      }
      const submission = await tx.formSubmission.create({ data: {
        id: generateId("submission"),
        formId: form.id,
        formVersionId: version.id,
        respondentEmail: email,
        dedupeKey,
        source: "public",
        answers: { create: snapshot.sections.flatMap((section) => section.items).filter((item) => item.type !== "TEXT_BLOCK").flatMap((item) => {
          const value = result.data[item.id]
          if (!value || (Array.isArray(value) && !value.length)) return []
          return [{
            id: generateId("answer"),
            itemId: item.id,
            itemLabel: item.label,
            itemType: item.type,
            value: (item.type === "SINGLE_CHOICE" && value === otherValue(item)) || (item.type === "MULTIPLE_CHOICE" && Array.isArray(value) && value.includes(otherValue(item)))
              ? { value, other: result.data[otherName(item)] }
              : value,
          }]
        }) },
      } })
      return { submissionId: submission.id, successMessage: snapshot.settings.successMessage, redirectUrl: snapshot.settings.redirectUrl }
    }, { timeout: 30000 })
    // Delivery runs after commit and cannot turn a saved response into a failed submission.
    try {
      await notifyNewFormResponse(prisma, input.id)
    } catch (error) {
      console.error("Failed to notify team about new response", error)
    }
    return result
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new TRPCError({ code: "BAD_REQUEST", cause: duplicateEmailError(messages.duplicate) })
    }
    throw error
  }
}

function duplicateEmailError(message: string) {
  // AppForm maps Zod paths to input errors through the tRPC error formatter.
  return z.object({ respondentEmail: z.string().refine(() => false, message) }).safeParse({ respondentEmail: "" }).error!
}
