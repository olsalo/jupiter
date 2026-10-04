import type { FormApi } from "@rvf/react"
import { useRef } from "react"
import { useTranslation } from "react-i18next"

import { ItemTypeSelect } from "./item-type-select"
import type { FormItemEditorProps } from "../form-editor-types"
import { EditorDescriptionSwitch, useEditorDescription } from "./editor-description-switch"
import { useEditorItemValues } from "./use-editor-item-values"
import { AppForm } from "~/components/app-form"
import FormLabel from "~/components/form-label"
import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Switch } from "~/components/ui/switch"
import { textFormItemSchema, type TextFormItemInput } from "~/lib/forms/schemas/form-item"

export function TextItemEditor({ item, onChange, onTypeChange, onDelete, onDuplicate }: FormItemEditorProps<TextFormItemInput>) {
  const { t } = useTranslation("forms")
  const formRef = useRef<FormApi<TextFormItemInput>>(null)
  const captureValues = useEditorItemValues(formRef, onChange)
  const { showDescription, toggleDescription } = useEditorDescription(item.description)
  return (
    <AppForm<TextFormItemInput, TextFormItemInput, unknown>
      className="flex flex-col gap-4"
      ref={formRef}
      defaultValues={{
        label: item.label,
        description: item.description ?? "",
        required: item.required,
      }}
      id={`field-editor-${item.id}`}
      schema={textFormItemSchema}
      submitFn={() => captureValues()}
    >
      {(form) => {
        const requiredField = form.getControlProps("required")

        return (
          <>
            <div className="grid grid-cols-1 items-end gap-3.5 sm:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
              <FormLabel error={form.error("label")} label={t("field.question")}>
                <Input
                  {...form.getInputProps("label", {
                    "aria-invalid": Boolean(form.error("label")) || undefined,
                    maxLength: 500,
                    onBlur: captureValues,
                    placeholder: t("field.questionPlaceholder"),
                    type: "text",
                  })}
                />
              </FormLabel>

              <FormLabel label={t("field.type")}>
                <ItemTypeSelect
                  onChange={(type) => {
                    void captureValues().then(() => onTypeChange(type))
                  }}
                  value={item.type === "LONG_TEXT" ? "LONG_TEXT" : "SHORT_TEXT"}
                />
              </FormLabel>
            </div>

            {showDescription ? (
              <FormLabel error={form.error("description")} label={t("field.description")}>
                <Input
                  {...form.getInputProps("description", {
                    "aria-invalid": Boolean(form.error("description")) || undefined,
                    maxLength: 2000,
                    onBlur: captureValues,
                    placeholder: t("field.descriptionPlaceholder"),
                    type: "text",
                  })}
                />
              </FormLabel>
            ) : null}

            <div className="-mx-4 -mb-4 flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <Button
                  aria-label={t("field.delete")}
                  onClick={() => {
                    void captureValues().then(onDelete)
                  }}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <Icon aria-hidden="true" name="trash" size={18} />
                </Button>
                <Button
                  aria-label={t("field.duplicate")}
                  onClick={() => {
                    void captureValues().then(onDuplicate)
                  }}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <Icon aria-hidden="true" name="copy" size={18} />
                </Button>
              </div>

              <div className="ms-auto flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
                <EditorDescriptionSwitch
                  checked={showDescription}
                  onCheckedChange={(checked) => {
                    form.setValue("description", toggleDescription(checked, form.transient.value("description")))
                    void captureValues()
                  }}
                />
                <label className="flex cursor-pointer items-center gap-3 text-xs font-medium text-foreground">
                  {t("field.required")}
                  <Switch
                    checked={requiredField.value}
                    inputRef={requiredField.ref}
                    name={requiredField.name}
                    onCheckedChange={(checked) => {
                      requiredField.onChange(checked)
                    }}
                  />
                </label>
              </div>
            </div>
          </>
        )
      }}
    </AppForm>
  )
}
