import type { z } from "zod"
import type { formSnapshotSchema } from "./form-snapshot"

export type { FormSettings } from "./schemas/form-settings"

// Shared DTOs deliberately have no dependency on Prisma or the editor UI.
export type FormItemType =
  | "HEADING" | "TEXT_BLOCK" | "DIVIDER" | "IMAGE"
  | "SHORT_TEXT" | "LONG_TEXT" | "EMAIL" | "PHONE" | "URL"
  | "NUMBER" | "LINEAR_SCALE" | "RATING" | "DATE" | "TIME" | "DATETIME"
  | "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "DROPDOWN" | "CHECKBOX"
  | "MULTIPLE_CHOICE_GRID" | "CHECKBOX_GRID" | "FILE"

export type FormItem = {
  id: string
  type: FormItemType
  label: string
  description: string | null
  placeholder: string | null
  required: boolean
  sortOrder: number
  row: number
  column: number
  width: number
  defaultValue: unknown
  validation: unknown
  settings: unknown
  options: {
    id: string
    kind: "OPTION" | "ROW" | "COLUMN"
    label: string
    value: string
    sortOrder: number
  }[]
}

export type FormSection = {
  id: string
  title: string | null
  description: string | null
  sortOrder: number
  settings: unknown
  items: FormItem[]
}

export type FormLogicRule = {
  id: string
  sourceItemId: string
  operator: "EQUALS" | "NOT_EQUALS" | "CONTAINS" | "NOT_CONTAINS" | "GREATER_THAN" | "GREATER_THAN_OR_EQUAL" | "LESS_THAN" | "LESS_THAN_OR_EQUAL" | "IS_EMPTY" | "IS_NOT_EMPTY"
  comparisonValue: unknown
  action: "GO_TO_SECTION" | "SUBMIT_FORM"
  targetSectionId: string | null
  priority: number
}

export type FormEditorDraft = {
  id: string
  slug: string
  title: string
  description: string | null
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED"
  draftRevision: number
  publishedVersion: number | null
  hasUnpublishedChanges?: boolean
  publishedSnapshot?: FormSnapshot | null
  settings: {
    submitButtonText: string
    successMessage: string
    redirectUrl: string | null
    emailCollection: "NONE" | "OPTIONAL" | "REQUIRED"
    limitOneResponsePerEmail: boolean
    responseLimit: number | null
    startsAt: Date | null
    closesAt: Date | null
  }
  appearance: {
    theme: "SYSTEM" | "LIGHT" | "DARK"
    accentColor: string | null
    logo: string | null
    showProgressBar: boolean
    showQuestionNumbers: boolean
  }
  sections: FormSection[]
  logicRules: FormLogicRule[]
}

export type FormAnswerValues = Record<string, string | string[]>

export type FormSnapshot = z.infer<typeof formSnapshotSchema>
export type PublishedForm = {
  formId: string
  versionId: string
  version: number
  snapshot: FormSnapshot
}

export const supportedItemTypes = ["SHORT_TEXT", "LONG_TEXT", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "TEXT_BLOCK"] as const

export function isSupportedItem(type: FormItemType) {
  return supportedItemTypes.some((supported) => supported === type)
}

export function isAnswerableItem(type: FormItemType) {
  return !["HEADING", "TEXT_BLOCK", "DIVIDER", "IMAGE"].includes(type)
}
