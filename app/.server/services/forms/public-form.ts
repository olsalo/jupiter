import { TRPCError } from "@trpc/server"
import type { Form } from "../../../../generated/prisma/client"
import { formSnapshotSchema } from "~/lib/forms/form-snapshot"
import type { PublishedForm } from "~/lib/forms/form-types"
import type { prisma as client } from "~/lib/prisma.server"
import { applyLiveFormSettings, formRuntimeSettingsSelect } from "./form-runtime-settings"

export class PublicFormNotFoundError extends TRPCError {
  constructor() {
    super({ code: "NOT_FOUND", message: "Form not found." })
  }
}

export function validateAvailability(form: Pick<Form, "enabled" | "status" | "publishedVersion" | "startsAt" | "closesAt" | "responseLimit">, responseCount: number, now = new Date()) {
  if (!form.enabled || form.status !== "PUBLISHED" || form.publishedVersion === null) throw new TRPCError({ code: "NOT_FOUND", message: "This form is not accepting responses." })
  if (form.startsAt && now < form.startsAt) throw new TRPCError({ code: "FORBIDDEN", message: "This form is not open yet." })
  if (form.closesAt && now >= form.closesAt) throw new TRPCError({ code: "FORBIDDEN", message: "This form is closed." })
  if (form.responseLimit !== null && responseCount >= form.responseLimit) throw new TRPCError({ code: "FORBIDDEN", message: "This form has reached its response limit." })
}

export async function getPublishedForm(prisma: typeof client, id: string): Promise<PublishedForm> {
  const form = await prisma.form.findUnique({ where: { id }, select: {
    ...formRuntimeSettingsSelect,
    id: true, enabled: true, status: true, publishedVersion: true, startsAt: true, closesAt: true, responseLimit: true,
    _count: { select: { submissions: true } },
  } })
  if (!form) throw new PublicFormNotFoundError()
  validateAvailability(form, form._count.submissions)
  const version = await prisma.formVersion.findUnique({ where: { formId_version: { formId: form.id, version: form.publishedVersion! } } })
  if (!version) throw new TRPCError({ code: "NOT_FOUND" })
  return { formId: form.id, versionId: version.id, version: version.version, snapshot: applyLiveFormSettings(formSnapshotSchema.parse(version.snapshot), form) }
}
