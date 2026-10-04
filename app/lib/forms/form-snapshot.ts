import { z } from "zod"
import type { FormEditorDraft } from "./form-types"
import { choiceValidationSchema, multipleChoiceValidationSchema, formItemIdSchema, textValidationSchema } from "./form-item-config"

const safeUrl = z.string().url().refine((url) => /^https?:\/\//i.test(url))
const baseItem = z.object({
  id: formItemIdSchema,
  label: z.string().max(500),
  description: z.string().max(2000).nullable(),
  placeholder: z.string().max(500).nullable(),
  required: z.boolean(),
  sortOrder: z.number().int().min(0),
  row: z.number().int().min(0),
  column: z.number().int().min(0).max(11),
  width: z.number().int().min(1).max(12),
  defaultValue: z.string().nullable(),
  options: z.array(z.object({
    id: z.string().min(1),
    kind: z.literal("OPTION"),
    label: z.string().trim().min(1).max(500),
    value: z.string().min(1),
    sortOrder: z.number().int().min(0),
  })).max(100),
})

export const snapshotItemSchema = z.discriminatedUnion("type", [
  baseItem.extend({ type: z.literal("SHORT_TEXT"), validation: textValidationSchema.nullable(), settings: z.object({}).strict().nullable() }),
  baseItem.extend({ type: z.literal("LONG_TEXT"), validation: textValidationSchema.nullable(), settings: z.object({}).strict().nullable() }),
  baseItem.extend({ type: z.literal("SINGLE_CHOICE"), validation: choiceValidationSchema.nullable(), settings: z.object({ allowOther: z.boolean() }).strict().nullable() }),
  baseItem.extend({ type: z.literal("MULTIPLE_CHOICE"), defaultValue: z.array(z.string()).max(101).nullable(), validation: multipleChoiceValidationSchema.nullable(), settings: z.object({ allowOther: z.boolean() }).strict().nullable() }),
  baseItem.extend({ type: z.literal("TEXT_BLOCK"), required: z.literal(false), validation: z.null(), settings: z.null(), defaultValue: z.null() }),
]).superRefine((item, context) => {
  if ((item.type === "SINGLE_CHOICE" || item.type === "MULTIPLE_CHOICE") && !item.options.length) {
    context.addIssue({ code: "custom", path: ["options"], message: "Add at least one option." })
  }
  if (new Set(item.options.map((option) => option.value)).size !== item.options.length) {
    context.addIssue({ code: "custom", path: ["options"], message: "Option values must be unique." })
  }
  if (item.options.some((option) => option.value === `other:${item.id}`)) {
    context.addIssue({ code: "custom", path: ["options"], message: "Reserved option value." })
  }
})

export const formSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string().trim().min(1).max(500),
  description: z.string().max(2000).nullable(),
  settings: z.object({
    submitButtonText: z.string().trim().min(1).max(100),
    successMessage: z.string().trim().min(1).max(2000),
    redirectUrl: safeUrl.nullable(),
    emailCollection: z.enum(["NONE", "OPTIONAL", "REQUIRED"]),
    limitOneResponsePerEmail: z.boolean(),
  }).refine((settings) => !settings.limitOneResponsePerEmail || settings.emailCollection === "REQUIRED"),
  appearance: z.object({
    theme: z.enum(["SYSTEM", "LIGHT", "DARK"]),
    accentColor: z.string().regex(/^#[\da-f]{6}$/i).nullable(),
    logo: safeUrl.nullable(),
    showProgressBar: z.boolean(),
    showQuestionNumbers: z.boolean(),
  }),
  sections: z.array(z.object({
    id: z.string().min(1),
    title: z.string().max(500).nullable(),
    description: z.string().max(2000).nullable(),
    sortOrder: z.number().int().min(0),
    items: z.array(snapshotItemSchema).max(500),
  })).min(1).max(100),
  // Rules have their own draft DTO. Enable them here only with a shared evaluator.
  logicRules: z.array(z.never()).max(0),
}).superRefine((snapshot, context) => {
  const items = snapshot.sections.flatMap((section) => section.items)
  if (items.length > 500) {
    context.addIssue({ code: "custom", path: ["sections"], message: "A form can contain at most 500 items." })
  }
  if (new Set(snapshot.sections.map((section) => section.id)).size !== snapshot.sections.length) {
    context.addIssue({ code: "custom", path: ["sections"], message: "Section IDs must be unique." })
  }
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    context.addIssue({ code: "custom", path: ["sections"], message: "Item IDs must be unique." })
  }
})

// The same whitelist and transformation is used for draft preview and publishing.
export function buildFormSnapshot(draft: FormEditorDraft) {
  return formSnapshotSchema.parse({
    schemaVersion: 1,
    title: draft.title,
    description: draft.description,
    settings: {
      submitButtonText: draft.settings.submitButtonText,
      successMessage: draft.settings.successMessage,
      redirectUrl: draft.settings.redirectUrl,
      emailCollection: draft.settings.emailCollection,
      limitOneResponsePerEmail: draft.settings.limitOneResponsePerEmail,
    },
    appearance: draft.appearance,
    sections: [...draft.sections].sort((a, b) => a.sortOrder - b.sortOrder).map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      sortOrder: section.sortOrder,
      items: [...section.items].sort((a, b) => a.sortOrder - b.sortOrder).map((item) => ({
        id: item.id,
        type: item.type,
        label: item.label,
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
        options: [...item.options].sort((a, b) => a.sortOrder - b.sortOrder),
      })),
    })),
    logicRules: draft.logicRules,
  })
}
