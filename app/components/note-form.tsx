import type { inferRouterInputs } from "@trpc/server"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import type { AppRouter } from "~/.server/main"
import { AppForm, type AppFormState } from "~/components/app-form"
import FormLabel from "~/components/form-label"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"
import { noteFormSchema } from "~/lib/schemas/notes"

export type NoteFormInput = inferRouterInputs<AppRouter>["example"]["create"]

export function NoteForm({
  defaultValues,
  id,
  onDirtyChange,
  submitFn,
}: {
  defaultValues: NoteFormInput
  id: string
  onDirtyChange?: (isDirty: boolean) => void
  submitFn: (input: NoteFormInput) => Promise<unknown>
}) {
  const { t } = useTranslation("notes")
  const handleFormStateChange = useCallback(
    ({ isDirty }: AppFormState) => onDirtyChange?.(isDirty),
    [onDirtyChange],
  )

  return (
    <AppForm<NoteFormInput, NoteFormInput, unknown>
      className="flex w-full flex-col gap-5"
      defaultValues={defaultValues}
      id={id}
      onFormStateChange={onDirtyChange ? handleFormStateChange : undefined}
      schema={noteFormSchema}
      submitFn={submitFn}
    >
      {(form) => (
        <>
          <FormLabel error={form.error("title")} label={t("form.title.label")}>
            <Input
              {...form.getInputProps("title", {
                "aria-invalid": Boolean(form.error("title")) || undefined,
                placeholder: t("form.title.placeholder"),
                type: "text",
              })}
            />
          </FormLabel>

          <FormLabel error={form.error("body")} label={t("form.body.label")}>
            <Textarea
              {...form.getInputProps("body", {
                "aria-invalid": Boolean(form.error("body")) || undefined,
                placeholder: t("form.body.placeholder"),
              })}
            />
          </FormLabel>
        </>
      )}
    </AppForm>
  )
}
