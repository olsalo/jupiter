import { DragDropProvider } from "@dnd-kit/react"
import { isSortable } from "@dnd-kit/react/sortable"
import type { FormApi } from "@rvf/react"
import { useRef } from "react"
import { useTranslation } from "react-i18next"

import { ItemTypeSelect } from "./item-type-select"
import { getAllowOther } from "~/lib/forms/form-item-settings"
import { SortableOptionRow } from "./sortable-option-row"
import type { FormItemEditorProps } from "../form-editor-types"
import { EditorDescriptionSwitch, useEditorDescription } from "./editor-description-switch"
import { useEditorItemValues } from "./use-editor-item-values"
import { AppForm } from "~/components/app-form"
import FormLabel from "~/components/form-label"
import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "~/components/ui/input-group"
import { Switch } from "~/components/ui/switch"
import {
  singleChoiceFormItemSchema,
  type SingleChoiceFormItemInput,
} from "~/lib/forms/schemas/form-item"
import { generateId } from "~/lib/id"
import { Feedback } from '@dnd-kit/dom'
export function SingleChoiceItemEditor({
  item,
  onChange,
  onTypeChange,
  onDelete,
  onDuplicate,
}: FormItemEditorProps<SingleChoiceFormItemInput>) {
  const { t } = useTranslation("forms")
  const formRef = useRef<FormApi<SingleChoiceFormItemInput>>(null)
  const optionListRef = useRef<HTMLDivElement>(null)
  const captureValues = useEditorItemValues(formRef, onChange)
  const { showDescription, toggleDescription } = useEditorDescription(item.description)

  return (
    <AppForm<SingleChoiceFormItemInput, SingleChoiceFormItemInput, unknown>
      className="flex flex-col gap-4"
      ref={formRef}
      defaultValues={{
        label: item.label,
        description: item.description ?? "",
        required: item.required,
        options: item.options.map((option) => ({
          id: option.id,
          label: option.label,
          value: option.value,
        })),
        allowOther: getAllowOther(item.settings),
      }}
      id={`field-editor-${item.id}`}
      schema={singleChoiceFormItemSchema}
      submitFn={() => captureValues()}
    >
      {(form) => {
        const requiredField = form.getControlProps("required")
        const options = form.array("options")
        const allowOther = form.value("allowOther")
        const fillEmptyOptionLabels = () => {
          form.value("options").forEach((option, index) => {
            if (option.label.trim()) return
            form.setValue(
              `options[${index}].label`,
              t("field.option", { number: index + 1 }),
            )
          })
        }

        return (
          <>
            <div className="grid grid-cols-1 items-end gap-3.5 sm:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
              <FormLabel
                error={form.error("label")}
                label={t("field.question")}
              >
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
                    void captureValues().then(() =>
                      onTypeChange(type),
                    )
                  }}
                  value={item.type === "MULTIPLE_CHOICE" ? "MULTIPLE_CHOICE" : "SINGLE_CHOICE"}
                />
              </FormLabel>
            </div>

            {showDescription ? (
              <FormLabel
                error={form.error("description")}
                label={t("field.description")}
              >
                <Input
                  {...form.getInputProps("description", {
                    "aria-invalid":
                      Boolean(form.error("description")) || undefined,
                    maxLength: 2000,
                    onBlur: captureValues,
                    placeholder: t("field.descriptionPlaceholder"),
                    type: "text",
                  })}
                />
              </FormLabel>
            ) : null}

            <div className="border-t border-border pt-4">
              <DragDropProvider
                plugins={(defaults) => [
                  ...defaults,
                  Feedback.configure({
                    dropAnimation: null,
                  }),
                ]}
                onDragEnd={(event) => {
                  if (event.canceled) return
                  const { source } = event.operation
                  if (
                    !isSortable(source) ||
                    source.initialIndex === source.index
                  )
                    return

                  const suspendedDrop = event.suspend()
                  void options
                    .move(source.initialIndex, source.index)
                    .then(() => {
                      suspendedDrop.resume()
                    })
                    .catch(() => suspendedDrop.abort())
                }}
              >
                <div className="flex flex-col gap-4" ref={optionListRef}>
                  {options.map((key, optionForm, index) => (
                    <SortableOptionRow
                      containerRef={optionListRef}
                      id={key}
                      index={index}
                      invalid={Boolean(optionForm.error("label"))}
                      key={key}
                      label={t("field.moveOption", { number: index + 1 })}
                    >
                      <InputGroup className="min-w-0 flex-1">
                        <InputGroupInput
                          {...optionForm.getInputProps("label", {
                            "aria-invalid":
                              Boolean(optionForm.error("label")) || undefined,
                            maxLength: 500,
                            "aria-label": t("field.optionLabel", {
                              number: index + 1,
                            }),
                            onBlur: (event) => {
                              if (!event.currentTarget.value.trim()) {
                                optionForm.setValue(
                                  "label",
                                  t("field.option", { number: index + 1 }),
                                )
                              }
                              queueMicrotask(captureValues)
                            },
                            placeholder: t("field.option", {
                              number: index + 1,
                            }),
                            type: "text",
                          })}
                        />
                        <InputGroupAddon align="inline-end">
                          <Button
                            aria-label={t("field.removeOption", {
                              number: index + 1,
                            })}
                            disabled={options.length() === 1}
                            onClick={() => {
                              void options.remove(index)
                            }}
                            size="icon-xs"
                            type="button"
                            variant="ghost"
                          >
                            <Icon aria-hidden="true" name="x" size={16} />
                          </Button>
                        </InputGroupAddon>
                      </InputGroup>
                    </SortableOptionRow>
                  ))}
                </div>
                {allowOther ? (
                  <div
                    className="relative mt-4 flex h-8.5 w-full items-center gap-2.5 sm:h-7.5"
                  >
                    <span className="h-full w-6 shrink-0" />
                    <InputGroup className="min-w-0 flex-1">
                      <InputGroupText className="h-8.5 min-w-0 flex-1 px-[calc(--spacing(3)-1px)] text-foreground leading-8.5 sm:h-7.5 sm:leading-7.5">
                        {t("field.otherOption")}
                      </InputGroupText>
                      <InputGroupAddon align="inline-end">
                        <Button
                          aria-label={t("field.removeOther")}
                          onClick={() => {
                            form.setValue("allowOther", false)
                          }}
                          size="icon-xs"
                          type="button"
                          variant="ghost"
                        >
                          <Icon aria-hidden="true" name="x" size={16} />
                        </Button>
                      </InputGroupAddon>
                    </InputGroup>
                  </div>
                ) : null}
              </DragDropProvider>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                <Button
                  onClick={() => {
                    fillEmptyOptionLabels()
                    void options.push({
                      id: generateId("option"),
                      label: t("field.option", {
                        number: options.length() + 1,
                      }),
                      value: generateId("choice"),
                    })
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Icon aria-hidden="true" name="plus" size={18} />
                  {t("field.addOption")}
                </Button>
                {!allowOther ? (
                  <Button
                    onClick={() => {
                      fillEmptyOptionLabels()
                      form.setValue("allowOther", true)
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Icon aria-hidden="true" name="plus" size={18} />
                    {t("field.addOther")}
                  </Button>
                ) : null}
              </div>
            </div>

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
