import { TRPCError } from "@trpc/server"
import { Prisma } from "../../../../generated/prisma/client"
import { formEditorInclude, toEditorDraft } from "./form-editor"
import { isAnswerableItem } from "~/lib/forms/form-types"
import { buildFormSnapshot } from "~/lib/forms/form-snapshot"
import { generateId } from "~/lib/id"
import type { prisma as client } from "~/lib/prisma.server"

export async function publishForm(prisma: typeof client, organizationId: string, input: { id: string, revision: number }) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM form WHERE id = ${input.id} AND "organizationId" = ${organizationId} FOR UPDATE`)
    if (!locked.length) throw new TRPCError({ code: "NOT_FOUND" })
    const form = await tx.form.findUniqueOrThrow({ where: { id: input.id }, include: formEditorInclude })
    if (form.draftRevision !== input.revision) throw new TRPCError({ code: "CONFLICT" })
    if (!form.sections.some((section) => section.items.some((item) => isAnswerableItem(item.type)))) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Add at least one question before publishing." })
    }
    let snapshot
    try {
      snapshot = buildFormSnapshot(toEditorDraft(form))
    } catch {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Check the form options and settings before publishing. Only supported items and settings can be published." })
    }
    const latest = await tx.formVersion.findFirst({ where: { formId: input.id }, orderBy: { version: "desc" }, select: { version: true } })
    const version = await tx.formVersion.create({ data: {
      id: generateId("version"),
      formId: input.id,
      version: (latest?.version ?? 0) + 1,
      snapshot,
    } })
    await tx.form.update({ where: { id: input.id }, data: { status: "PUBLISHED", publishedVersion: version.version, publishedAt: new Date() } })
    return { versionId: version.id, version: version.version, slug: form.slug }
  }, { timeout: 30000 })
}
