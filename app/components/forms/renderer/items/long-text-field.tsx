import { useTranslation } from "react-i18next"

import { QuestionLabel } from "../question-label"
import type { FormItemInputProps } from "../form-renderer-types"
import FormLabel from "~/components/form-label"
import { Textarea } from "~/components/ui/textarea"

export function LongTextField({ item, form }: FormItemInputProps) {
  const { t } = useTranslation("forms")
  const error = form.error(item.id)

  return (
    <FormLabel
      className="gap-1"
      description={item.description}
      descriptionClassName="text-xs leading-4"
      descriptionPlacement="before"
      error={error}
      errorPlacement="below"
      label={<QuestionLabel item={item} />}
      labelClassName="text-base leading-6 sm:text-base"
    >
      <Textarea
        {...form.getInputProps(item.id, {
          "aria-invalid": Boolean(error) || undefined,
          placeholder: t("field.answerPlaceholder"),
        })}
        className="mt-1"
        rows={4}
        size="lg"
      />
    </FormLabel>
  )
}
