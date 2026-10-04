import type { FormApi } from "@rvf/react"
import { LongTextField } from "./items/long-text-field"
import { ShortTextField } from "./items/short-text-field"
import { MultipleChoiceField } from "./items/multiple-choice-field"
import { SingleChoiceField } from "./items/single-choice-field"
import { TextBlock } from "./items/text-block"
import type { FormAnswerValues, FormSnapshot } from "~/lib/forms/form-types"

export function FormItemRenderer({ item, form }: {
  item: FormSnapshot["sections"][number]["items"][number]
  form: FormApi<FormAnswerValues>
}) {
  switch (item.type) {
    case "TEXT_BLOCK": return <TextBlock item={item} />
    case "SHORT_TEXT": return <ShortTextField item={item} form={form} />
    case "LONG_TEXT": return <LongTextField item={item} form={form} />
    case "MULTIPLE_CHOICE": return <MultipleChoiceField item={item} form={form} />
    case "SINGLE_CHOICE": return <SingleChoiceField item={item} form={form} />
  }
}
