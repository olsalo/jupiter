import { useTranslation } from "react-i18next"

import type { FormItem } from "~/lib/forms/form-types"
import { Badge } from "~/components/ui/badge"

export function QuestionLabel({ item }: { item: FormItem }) {
  const { t } = useTranslation("forms")

  return (
    <>
      <span className={item.label.trim() ? undefined : "sr-only"}>{item.label.trim() ? item.label : t("field.question")}</span>
      {!item.required ? <Badge size="sm" variant="secondary">{t("field.optional")}</Badge> : null}
    </>
  )
}
