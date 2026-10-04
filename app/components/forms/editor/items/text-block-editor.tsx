import type { FormApi } from "@rvf/react"
import { useRef } from "react"
import { useTranslation } from "react-i18next"

import { EditorDescriptionSwitch, useEditorDescription } from "./editor-description-switch"
import { useEditorItemValues } from "./use-editor-item-values"
import { AppForm } from "~/components/app-form"
import FormLabel from "~/components/form-label"
import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"
import { textBlockSchema, type TextBlockInput } from "~/lib/forms/schemas/form-item"
import type { FormItem } from "~/lib/forms/form-types"

export function TextBlockEditor({ item, onChange, onDelete, onDuplicate }: {
  item: FormItem
  onChange: (values: TextBlockInput) => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const { t } = useTranslation("forms")
  const formRef = useRef<FormApi<TextBlockInput>>(null)
  const captureValues = useEditorItemValues(formRef, onChange)
  const { showDescription, toggleDescription } = useEditorDescription(item.description)

  return (
    <AppForm<TextBlockInput, TextBlockInput, unknown>
      className="flex flex-col gap-4"
      defaultValues={{ label: item.label, description: item.description ?? "" }}
      id={`text-block-editor-${item.id}`}
      ref={formRef}
      schema={textBlockSchema}
      submitFn={() => captureValues()}
    >
      {(form) => (
        <>
          <FormLabel error={form.error("label")} label={t("textBlock.title")}>
            <Input
              {...form.getInputProps("label", {
                "aria-invalid": Boolean(form.error("label")) || undefined,
                maxLength: 500,
                onBlur: captureValues,
                placeholder: t("textBlock.titlePlaceholder"),
                type: "text",
              })}
            />
          </FormLabel>

          {showDescription ? (
            <FormLabel error={form.error("description")} label={t("textBlock.description")}>
              <Textarea
                {...form.getInputProps("description", {
                  "aria-invalid": Boolean(form.error("description")) || undefined,
                  maxLength: 2000,
                  onBlur: captureValues,
                  placeholder: t("textBlock.descriptionPlaceholder"),
                })}
                rows={3}
              />
            </FormLabel>
          ) : null}

          <div className="-mx-4 -mb-4 flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <Button aria-label={t("textBlock.delete")} onClick={() => { void captureValues().then(onDelete) }} size="icon" type="button" variant="outline">
                <Icon aria-hidden="true" name="trash" size={18} />
              </Button>
              <Button aria-label={t("textBlock.duplicate")} onClick={() => { void captureValues().then(onDuplicate) }} size="icon" type="button" variant="outline">
                <Icon aria-hidden="true" name="copy" size={18} />
              </Button>
            </div>
            <EditorDescriptionSwitch
              checked={showDescription}
              onCheckedChange={(checked) => {
                form.setValue("description", toggleDescription(checked, form.transient.value("description")))
                void captureValues()
              }}
            />
          </div>
        </>
      )}
    </AppForm>
  )
}
