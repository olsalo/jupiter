import { SingleChoiceItemEditor } from "./items/single-choice-item-editor"
import { TextBlockEditor } from "./items/text-block-editor"
import { TextItemEditor } from "./items/text-item-editor"
import type { EditableItemType } from "./form-editor-types"
import type { FormItem } from "~/lib/forms/form-types"
import type { SingleChoiceFormItemInput, TextBlockInput, TextFormItemInput } from "~/lib/forms/schemas/form-item"

export function FormItemEditor({ item, formId, onChange, onTypeChange, onDelete, onDuplicate }: {
  item: FormItem
  formId: string
  onChange: (values: TextFormItemInput | SingleChoiceFormItemInput | TextBlockInput) => void
  onTypeChange: (type: EditableItemType) => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const common = { item, formId, onChange, onTypeChange, onDelete, onDuplicate }
  switch (item.type) {
    case "TEXT_BLOCK": return <TextBlockEditor {...common} />
    case "SHORT_TEXT":
    case "LONG_TEXT": return <TextItemEditor {...common} />
    case "MULTIPLE_CHOICE":
    case "SINGLE_CHOICE": return <SingleChoiceItemEditor {...common} />
    default: return null
  }
}
