import type { FormItem } from "~/lib/forms/form-types"

export type EditableItemType = "SHORT_TEXT" | "LONG_TEXT" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE"

export type FormItemEditorProps<Values> = {
  item: FormItem
  formId: string
  onChange: (values: Values) => void
  onTypeChange: (type: EditableItemType) => void
  onDelete: () => void
  onDuplicate: () => void
}
