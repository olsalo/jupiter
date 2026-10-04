import type { FormApi } from "@rvf/react"
import type { FormAnswerValues, FormItem } from "~/lib/forms/form-types"

export type FormItemInputProps = {
  item: FormItem
  form: FormApi<FormAnswerValues>
}
