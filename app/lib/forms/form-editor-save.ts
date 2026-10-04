import type { FormEditorDraft, FormItem } from "./form-types"
import { getAllowOther } from "./form-item-settings"
import { draftItemSchema } from "./schemas/form-draft"

export function getFormDraftPayload(draft: FormEditorDraft) {
  return {
    title: draft.title.trim(),
    description: draft.description?.trim() || null,
    sections: draft.sections.map((section) => ({ id: section.id, items: draftItems(section.items) })),
  }
}

function draftItems(items: FormItem[]) {
  return items.map((item) => {
    const common = {
      id: item.id,
      label: item.label.trim(),
      description: (item.description ?? "").trim(),
      required: item.required,
      placeholder: item.placeholder,
      defaultValue: item.defaultValue,
      validation: item.validation,
      row: item.row,
      column: item.column,
      width: item.width,
    }
    if (item.type === "TEXT_BLOCK") return {
      id: item.id,
      type: "TEXT_BLOCK" as const,
      label: common.label,
      description: common.description,
      row: common.row,
      column: common.column,
      width: common.width,
    }
    if (item.type === "SINGLE_CHOICE" || item.type === "MULTIPLE_CHOICE") {
      return {
        ...common,
        type: item.type,
        allowOther: getAllowOther(item.settings),
        options: item.options.map((option) => ({
          id: option.id,
          label: option.label.trim(),
          value: option.value,
        })),
      }
    }
    if (item.type === "SHORT_TEXT" || item.type === "LONG_TEXT") return { ...common, type: item.type }
    return { id: item.id, type: item.type }
  }).map((item) => draftItemSchema.parse(item))
}

// Apply server normalization only when no newer edits were made during the save.
export function reconcileSavedFormDraft(current: FormEditorDraft, saved: FormEditorDraft, submitted: string) {
  return JSON.stringify(getFormDraftPayload(current)) === submitted
    ? saved
    : { ...current, draftRevision: saved.draftRevision }
}
