import type { FormApi } from "@rvf/react"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { useEditorItemValues } from "./items/use-editor-item-values"
import { AppForm } from "~/components/app-form"
import FormLabel from "~/components/form-label"
import { Input } from "~/components/ui/input"
import { Switch } from "~/components/ui/switch"
import { Textarea } from "~/components/ui/textarea"
import { formHeadingSchema, type FormHeadingInput } from "~/lib/forms/schemas/form-draft"

export function FormHeadingEditor({ formId, title, description, onChange }: {
  formId: string
  title: string
  description: string | null
  onChange: (values: FormHeadingInput) => void
}) {
  const { t } = useTranslation("forms")
  const formRef = useRef<FormApi<FormHeadingInput>>(null)
  const [showDescription, setShowDescription] = useState(Boolean(description))
  const descriptionRef = useRef(description ?? "")
  const captureValues = useEditorItemValues(formRef, onChange)

  return (
    <AppForm<FormHeadingInput, FormHeadingInput, unknown>
      className="flex flex-col gap-4"
      defaultValues={{ title: title.replace(/^Untitled(?=_\d+$|$)/, t("untitled")), description: description ?? "" }}
      id={`form-heading-editor-${formId}`}
      ref={formRef}
      schema={formHeadingSchema}
      submitFn={() => captureValues()}
      validationBehaviorConfig={{ initial: "onBlur", whenSubmitted: "onChange", whenTouched: "onChange" }}
    >
      {(form) => (
        <>
          <FormLabel error={form.error("title")} label={t("heading.title")}>
            <Input
              {...form.getInputProps("title", {
                "aria-invalid": Boolean(form.error("title")) || undefined,
                maxLength: 500,
                onBlur: captureValues,
                placeholder: t("heading.titlePlaceholder"),
                type: "text",
              })}
            />
          </FormLabel>
          {showDescription ? (
            <FormLabel error={form.error("description")} label={t("heading.description")}>
              <Textarea
                {...form.getInputProps("description", {
                  "aria-invalid": Boolean(form.error("description")) || undefined,
                  maxLength: 2000,
                  onBlur: captureValues,
                  placeholder: t("heading.descriptionPlaceholder"),
                })}
                rows={3}
              />
            </FormLabel>
          ) : null}
          <div className="-mx-4 -mb-4 flex items-center justify-end border-t border-border px-4 py-3">
            <label className="flex h-9 cursor-pointer items-center gap-3 text-xs font-medium text-foreground sm:h-8">
              {t("heading.addDescription")}
              <Switch
                checked={showDescription}
                onCheckedChange={(checked) => {
                  if (!checked) descriptionRef.current = form.transient.value("description")
                  form.setValue("description", checked ? descriptionRef.current : "")
                  setShowDescription(checked)
                  void captureValues()
                }}
              />
            </label>
          </div>
        </>
      )}
    </AppForm>
  )
}
