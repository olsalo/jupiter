import { useTranslation } from "react-i18next"

import { getSetting } from "~/lib/forms/form-item-settings"
import { otherName, otherValue } from "~/lib/forms/form-validation"
import { QuestionLabel } from "../question-label"
import type { FormItemInputProps } from "../form-renderer-types"
import FormLabel from "~/components/form-label"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Checkbox } from "~/components/ui/checkbox"
import { CheckboxGroup } from "~/components/ui/checkbox-group"

export function MultipleChoiceField({ item, form }: FormItemInputProps) {
  const { t } = useTranslation("forms")
  const choice = form.getControlProps(item.id)
  const error = form.error(item.id)
  const allowOther = getSetting(item.settings, "allowOther") === true
  const values = Array.isArray(choice.value) ? choice.value : []
  const otherSelected = values.includes(otherValue(item))

  return (
    <div className="flex flex-col gap-2">
      <FormLabel
        className="gap-1 [&>[data-slot=field-error]]:mt-2"
        description={item.description}
        descriptionClassName="text-xs leading-4"
        descriptionPlacement="before"
        error={error}
        errorPlacement="below"
        label={<QuestionLabel item={item} />}
        labelClassName="text-base leading-6 sm:text-base"
      >
        <CheckboxGroup
          aria-invalid={Boolean(error) || undefined}
          aria-label={item.label.trim() || t("field.question")}
          className="mt-3 w-full"
          onBlur={choice.onBlur}
          onValueChange={choice.onChange}
          value={values}
        >
          {item.options.map((option) => (
            <Label className="relative w-fit cursor-pointer gap-2.5 font-normal" key={option.id}>
              <Checkbox
                aria-invalid={Boolean(error) || undefined}
                inputRef={option === item.options[0] ? choice.ref : undefined}
                name={choice.name}
                value={option.value}
              />
              {option.label}
            </Label>
          ))}
          {allowOther ? (
            <div className="flex w-full flex-col gap-2">
              <Label className="relative w-fit cursor-pointer gap-2.5 font-normal">
                <Checkbox
                  aria-invalid={Boolean(error) || undefined}
                  name={choice.name}
                  value={otherValue(item)}
                />
                {t("field.otherOption")}
              </Label>
              {otherSelected ? (
                <FormLabel
                  className="min-w-0 w-full gap-0 pl-7"
                  error={form.error(otherName(item))}
                  errorPlacement="below"
                  label={t("field.otherAnswer")}
                  labelClassName="sr-only"
                >
                  <Input
                    {...form.getInputProps(otherName(item), {
                      "aria-invalid": Boolean(form.error(otherName(item))) || undefined,
                      placeholder: t("field.answerPlaceholder"),
                      type: "text",
                    })}
                    className="w-full"
                    size="default"
                  />
                </FormLabel>
              ) : null}
            </div>
          ) : null}
        </CheckboxGroup>
      </FormLabel>
    </div>
  )
}
