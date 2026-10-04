import { TRPCError } from "@trpc/server"
import { Prisma } from "../../../../generated/prisma/client"
import type { z } from "zod"
import type { FormEditorDraft } from "~/lib/forms/form-types"
import { generateId } from "~/lib/id"
import type { prisma as client } from "~/lib/prisma.server"
import type { saveDraftInput } from "~/lib/forms/schemas/form-draft"
import { hasUnpublishedFormChanges } from "~/lib/forms/form-publish-changes"
import { formSnapshotSchema } from "~/lib/forms/form-snapshot"

type Database = typeof client
export const formEditorInclude = {
  versions: { orderBy: { version: "desc" as const }, take: 1, select: { snapshot: true } },
  sections: {
    orderBy: { sortOrder: "asc" as const },
    include: { items: {
      orderBy: { sortOrder: "asc" as const },
      include: { options: { orderBy: { sortOrder: "asc" as const } } },
    } },
  },
  logicRules: { orderBy: { priority: "asc" as const } },
} satisfies Prisma.FormInclude

type EditorForm = Prisma.FormGetPayload<{ include: typeof formEditorInclude }>

export function toEditorDraft(form: EditorForm): FormEditorDraft {
  const draft: FormEditorDraft = {
    id: form.id,
    slug: form.slug,
    title: form.title,
    description: form.description,
    status: form.status,
    draftRevision: form.draftRevision,
    publishedVersion: form.publishedVersion,
    settings: {
      submitButtonText: form.submitButtonText,
      successMessage: form.successMessage,
      redirectUrl: form.redirectUrl,
      emailCollection: form.emailCollection,
      limitOneResponsePerEmail: form.limitOneResponsePerEmail,
      responseLimit: form.responseLimit,
      startsAt: form.startsAt,
      closesAt: form.closesAt,
    },
    appearance: {
      theme: form.theme,
      accentColor: form.accentColor,
      logo: form.logo,
      showProgressBar: form.showProgressBar,
      showQuestionNumbers: form.showQuestionNumbers,
    },
    sections: form.sections.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      sortOrder: section.sortOrder,
      settings: section.settings,
      items: section.items.map((item) => ({
        id: item.id,
        type: item.type,
        label: item.label ?? "",
        description: item.description,
        placeholder: item.placeholder,
        required: item.required,
        sortOrder: item.sortOrder,
        row: item.row,
        column: item.column,
        width: item.width,
        defaultValue: item.defaultValue,
        validation: item.validation,
        settings: item.settings,
        options: item.options.map(({ id, kind, label, value, sortOrder }) => ({ id, kind, label, value, sortOrder })),
      })),
    })),
    logicRules: form.logicRules.map(({ id, sourceItemId, operator, comparisonValue, action, targetSectionId, priority }) => ({
      id, sourceItemId, operator, comparisonValue, action, targetSectionId, priority,
    })),
  }
  const publishedSnapshot = formSnapshotSchema.safeParse(form.versions[0]?.snapshot)
  return {
    ...draft,
    publishedSnapshot: publishedSnapshot.success ? publishedSnapshot.data : null,
    hasUnpublishedChanges: hasUnpublishedFormChanges(draft, form.versions[0]?.snapshot),
  }
}

export async function getEditorDraft(prisma: Database, id: string, organizationId: string) {
  const form = await prisma.form.findFirst({ where: { id, organizationId }, include: formEditorInclude })
  if (!form) throw new TRPCError({ code: "NOT_FOUND" })
  return toEditorDraft(form)
}

export function createForm(prisma: Database, organizationId: string, userId: string) {
  return prisma.form.create({ data: {
    id: generateId("form"),
    slug: generateId("form"),
    organizationId,
    createdById: userId,
    sections: { create: { id: generateId("section") } },
  } })
}

export async function saveFormDraft(prisma: Database, organizationId: string, input: z.infer<typeof saveDraftInput>) {
  const sections = input.sections
  const items = sections.flatMap((section) => section.items)
  const ids = items.map((item) => item.id)
  const sectionIds = sections.map((section) => section.id)
  const optionIds = items.flatMap((item) => (item.type === "SINGLE_CHOICE" || item.type === "MULTIPLE_CHOICE") ? item.options.map((option) => option.id) : [])
  if (items.length > 500 || new Set(ids).size !== ids.length || new Set(sectionIds).size !== sectionIds.length || new Set(optionIds).size !== optionIds.length) {
    throw new TRPCError({ code: "BAD_REQUEST" })
  }
  for (const item of items) {
    if (item.type !== "SINGLE_CHOICE" && item.type !== "MULTIPLE_CHOICE") continue
    const values = item.options.map((option) => option.value)
    if (new Set(values).size !== values.length || values.includes(`other:${item.id}`)) throw new TRPCError({ code: "BAD_REQUEST" })
  }

  return prisma.$transaction(async (tx) => {
    // Compare-and-swap also takes the form row lock before changing any child rows.
    const claimed = await tx.form.updateMany({
      where: { id: input.id, organizationId, draftRevision: input.revision },
      data: {
        draftRevision: { increment: 1 },
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
      },
    })
    if (!claimed.count) {
      const exists = await tx.form.findFirst({ where: { id: input.id, organizationId }, select: { id: true } })
      throw new TRPCError({ code: exists ? "CONFLICT" : "NOT_FOUND" })
    }
    const form = await tx.form.findUniqueOrThrow({ where: { id: input.id }, include: formEditorInclude })
    const existingItems = new Map(form.sections.flatMap((section) => section.items).map((item) => [item.id, item]))
    const existingSections = new Set(form.sections.map((section) => section.id))

    for (const [sectionOrder, section] of sections.entries()) {
      if (existingSections.has(section.id)) {
        await tx.formSection.update({ where: { id: section.id }, data: { sortOrder: sectionOrder } })
      } else {
        await tx.formSection.create({ data: { id: section.id, formId: input.id, sortOrder: sectionOrder } })
      }
      for (const [sortOrder, item] of section.items.entries()) {
        const existing = existingItems.get(item.id)
        if (item.type !== "TEXT_BLOCK" && item.type !== "SHORT_TEXT" && item.type !== "LONG_TEXT" && item.type !== "SINGLE_CHOICE" && item.type !== "MULTIPLE_CHOICE") {
          if (!existing || existing.type !== item.type) throw new TRPCError({ code: "BAD_REQUEST" })
          await tx.formItem.update({ where: { id: item.id }, data: { sectionId: section.id, sortOrder } })
          continue
        }
        const sameType = existing?.type === item.type
        const validation: Prisma.JsonObject = "validation" in item && item.validation !== undefined
          ? { ...item.validation }
          : sameType && isJsonObject(existing.validation) ? { ...existing.validation } : {}
        if (item.type === "TEXT_BLOCK") {
          delete validation.minLength
          delete validation.minSelections
        } else if (item.type === "SHORT_TEXT" || item.type === "LONG_TEXT") {
          delete validation.minSelections
          if (item.required) validation.minLength = Math.max(1, typeof validation.minLength === "number" ? validation.minLength : 0)
          else if (validation.minLength === 1) delete validation.minLength
        } else {
          delete validation.minLength
          if (item.required) validation.minSelections = 1
          else delete validation.minSelections
        }
        const settings = (item.type === "SINGLE_CHOICE" || item.type === "MULTIPLE_CHOICE")
          ? { allowOther: item.allowOther }
          : sameType ? existing.settings ?? Prisma.DbNull : Prisma.DbNull
        const data = {
          sectionId: section.id,
          type: item.type,
          label: item.label,
          description: item.description || null,
          required: item.type === "TEXT_BLOCK" ? false : item.required,
          sortOrder,
          row: item.row ?? existing?.row ?? sortOrder,
          column: item.column ?? existing?.column ?? 0,
          width: item.width ?? existing?.width ?? 12,
          ...("placeholder" in item && item.placeholder !== undefined ? { placeholder: item.placeholder } : {}),
          settings: item.type === "TEXT_BLOCK" ? Prisma.DbNull : settings,
          validation: item.type === "TEXT_BLOCK" || !Object.keys(validation).length ? Prisma.DbNull : validation,
          ...("defaultValue" in item && item.defaultValue !== undefined
            ? { defaultValue: item.defaultValue ?? Prisma.DbNull }
            : !sameType ? { defaultValue: Prisma.DbNull } : {}),
        }
        if (existing) await tx.formItem.update({ where: { id: item.id }, data })
        else await tx.formItem.create({ data: { id: item.id, ...data } })
        if (item.type === "SINGLE_CHOICE" || item.type === "MULTIPLE_CHOICE") {
          await tx.formItemOption.deleteMany({ where: { itemId: item.id, id: { notIn: item.options.map((option) => option.id) } } })
          const existingOptions = new Map(existing?.options.map((option) => [option.id, option]) ?? [])
          for (const [optionOrder, option] of item.options.entries()) {
            const previous = existingOptions.get(option.id)
            // Renaming a label must never rewrite the machine value.
            if (previous && previous.value !== option.value) throw new TRPCError({ code: "BAD_REQUEST" })
            if (previous) {
              await tx.formItemOption.update({ where: { id: option.id }, data: { label: option.label, sortOrder: optionOrder } })
            } else {
              await tx.formItemOption.create({ data: { ...option, itemId: item.id, sortOrder: optionOrder } })
            }
          }
        } else {
          await tx.formItemOption.deleteMany({ where: { itemId: item.id } })
        }
      }
    }
    await tx.formItem.deleteMany({ where: { section: { formId: input.id }, id: { notIn: ids } } })
    await tx.formSection.deleteMany({ where: { formId: input.id, id: { notIn: sectionIds } } })
    return toEditorDraft(await tx.form.findUniqueOrThrow({ where: { id: input.id }, include: formEditorInclude }))
  }, { timeout: 30000 })
}

export async function duplicateForm(prisma: Database, organizationId: string, userId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const source = await tx.form.findFirst({ where: { id, organizationId }, include: formEditorInclude })
    if (!source) throw new TRPCError({ code: "NOT_FOUND" })
    const numberedTitle = source.title.match(/^(.*)_([1-9]\d*)$/)
    const baseTitle = numberedTitle?.[1] ?? source.title
    const siblings = await tx.form.findMany({ where: { organizationId, title: { startsWith: `${baseTitle}_` } }, select: { title: true } })
    const titles = new Set(siblings.map((form) => form.title))
    let suffix = numberedTitle ? Number(numberedTitle[2]) + 1 : 1
    while (titles.has(`${baseTitle}_${suffix}`)) suffix += 1
    const sectionIds = new Map(source.sections.map((section) => [section.id, generateId("section")]))
    const itemIds = new Map(source.sections.flatMap((section) => section.items).map((item) => [item.id, generateId("item")]))
    const { organizationId: _org, createdById: _user, id: _id, slug: _slug, title: _title, status: _status,
      draftRevision: _revision, publishedVersion: _version, publishedAt: _publishedAt, createdAt: _createdAt,
      updatedAt: _updatedAt, sections, logicRules, versions: _versions, ...settings } = source
    return tx.form.create({ data: {
      ...settings,
      id: generateId("form"),
      slug: generateId("form"),
      organizationId,
      createdById: userId,
      title: `${baseTitle}_${suffix}`,
      sections: { create: sections.map(({ id: sectionId, formId: _formId, createdAt: _created, updatedAt: _updated, items: sectionItems, settings: sectionSettings, ...section }) => ({
        ...section,
        id: sectionIds.get(sectionId),
        settings: sectionSettings ?? undefined,
        items: { create: sectionItems.map(({ id: itemId, sectionId: _sectionId, createdAt: _itemCreated, updatedAt: _itemUpdated, options, defaultValue, validation, settings: itemSettings, ...item }) => ({
          ...item,
          id: itemIds.get(itemId),
          defaultValue: defaultValue ?? undefined,
          validation: validation ?? undefined,
          settings: itemSettings ?? undefined,
          options: { create: options.map(({ label, value, kind, sortOrder }) => ({ id: generateId("option"), label, value, kind, sortOrder })) },
        })) },
      })) },
      logicRules: { create: logicRules.map(({ sourceItemId, operator, comparisonValue, action, targetSectionId, priority }) => ({
        id: generateId("rule"),
        sourceItemId: itemIds.get(sourceItemId)!,
        operator,
        comparisonValue: comparisonValue ?? undefined,
        action,
        targetSectionId: targetSectionId ? sectionIds.get(targetSectionId) : null,
        priority,
      })) },
    } })
  }, { timeout: 30000 })
}

function isJsonObject(value: Prisma.JsonValue | null): value is Prisma.JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
