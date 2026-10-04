import { TRPCError } from "@trpc/server"
import { Prisma } from "../../../../generated/prisma/client"

import { formSettingsSchema, type FormSettingsPatch } from "~/lib/forms/schemas/form-settings"
import { defaultTimeZone } from "~/lib/format-preference"
import type { prisma as client } from "~/lib/prisma.server"
import { z } from "~/lib/zod"

const settingsSelect = {
  id: true,
  draftRevision: true,
  status: true,
  publishedVersion: true,
  enabled: true,
  emailCollection: true,
  limitOneResponsePerEmail: true,
  startsAt: true,
  closesAt: true,
  submitButtonText: true,
  successMessage: true,
  redirectUrl: true,
  theme: true,
  accentColor: true,
  organization: { select: { settings: { select: { timezone: true } } } },
} as const satisfies Prisma.FormSelect

type SettingsForm = Prisma.FormGetPayload<{ select: typeof settingsSelect }>

function toSettings({ enabled, organization, startsAt, closesAt, status, publishedVersion, ...form }: SettingsForm) {
  return {
    ...form,
    status: enabled,
    isPublished: status === "PUBLISHED" && publishedVersion !== null,
    startsAt: startsAt?.toISOString() ?? null,
    closesAt: closesAt?.toISOString() ?? null,
    timeZone: organization.settings?.timezone ?? defaultTimeZone,
  }
}

export async function getFormSettings(prisma: typeof client, organizationId: string, id: string) {
  const settings = await prisma.form.findFirst({ where: { id, organizationId }, select: settingsSelect })
  if (!settings) throw new TRPCError({ code: "NOT_FOUND" })
  return toSettings(settings)
}

export async function updateFormSettings(prisma: typeof client, organizationId: string, id: string, settings: FormSettingsPatch) {
  return prisma.$transaction(async (tx) => {
    // Lock before reading coupled email and schedule fields so concurrent patches merge safely.
    const locked = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM form WHERE id = ${id} AND "organizationId" = ${organizationId} FOR UPDATE`)
    if (!locked.length) throw new TRPCError({ code: "NOT_FOUND" })
    const form = await tx.form.findUniqueOrThrow({ where: { id }, select: settingsSelect })
    if (!toSettings(form).isPublished) {
      const availabilityField = (["status", "startsAt", "closesAt"] as const).find((field) => settings[field] !== undefined)
      if (availabilityField) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          cause: new z.ZodError([{ code: "custom", path: [availabilityField], message: "publishFirst" }]),
        })
      }
    }
    const patch = { ...settings }
    if (patch.limitOneResponsePerEmail === true && patch.emailCollection === undefined) {
      patch.emailCollection = "REQUIRED"
    } else if (patch.emailCollection !== undefined && patch.emailCollection !== "REQUIRED" && patch.limitOneResponsePerEmail === undefined) {
      patch.limitOneResponsePerEmail = false
    }
    const { id: _id, draftRevision: _revision, timeZone: _timeZone, isPublished: _isPublished, ...current } = toSettings(form)
    const result = formSettingsSchema.safeParse({ ...current, ...patch })
    if (!result.success) {
      if (patch.startsAt !== undefined && patch.closesAt === undefined) {
        for (const issue of result.error.issues) {
          if (issue.message === "invalidSchedule") issue.path.splice(0, issue.path.length, "startsAt")
        }
      }
      throw new TRPCError({ code: "BAD_REQUEST", cause: result.error })
    }
    const { status, startsAt, closesAt, ...fields } = patch
    return toSettings(await tx.form.update({
      where: { id },
      data: {
        ...fields,
        ...(status !== undefined ? { enabled: status } : {}),
        ...(startsAt !== undefined ? { startsAt: startsAt === null ? null : new Date(startsAt) } : {}),
        ...(closesAt !== undefined ? { closesAt: closesAt === null ? null : new Date(closesAt) } : {}),
      },
      select: settingsSelect,
    }))
  })
}
