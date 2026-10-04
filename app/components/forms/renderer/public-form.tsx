import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { FormItemRenderer } from "./form-item-renderer"
import { FormHeading } from "./form-heading"
import { AppForm } from "~/components/app-form"
import FormLabel from "~/components/form-label"
import { useFormPresentation } from "~/components/forms/use-form-presentation"
import { Button } from "~/components/ui/button"
import { Card } from "~/components/ui/card"
import { Dialog, DialogDescription, DialogPopup, DialogTitle } from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { Spinner } from "~/components/ui/spinner"
import type { FormAnswerValues, FormSnapshot } from "~/lib/forms/form-types"
import { createSubmissionSchema, defaultAnswerValues } from "~/lib/forms/form-validation"
import { cn } from "~/lib/utils"

type SubmissionResult = { successMessage: string, redirectUrl: string | null }

// Preview and public routes supply the same snapshot and differ only in submitFn.
export function PublicForm({ snapshot, submitFn, preview = false, initialEmail = "" }: {
  snapshot: FormSnapshot
  submitFn: (values: FormAnswerValues) => Promise<SubmissionResult | void>
  preview?: boolean
  initialEmail?: string
}) {
  const { t } = useTranslation("forms")
  const [success, setSuccess] = useState<SubmissionResult | null>(null)
  const [redirecting, setRedirecting] = useState(false)
  const schema = useMemo(() => createSubmissionSchema(snapshot, {
    required: t("preview.required"), other: t("preview.otherRequired"), email: t("public.emailInvalid"),
  }), [snapshot, t])
  const defaultValues = useMemo(() => ({
    ...defaultAnswerValues(snapshot),
    respondentEmail: snapshot.settings.emailCollection === "NONE" ? "" : initialEmail.trim(),
  }), [snapshot, initialEmail])
  const presentation = useFormPresentation(snapshot.appearance)

  return (
    <div
      className={cn("relative isolate min-h-full px-4 pt-12 pb-6 text-foreground sm:px-6 sm:pt-16 sm:pb-8", presentation.className)}
      style={presentation.style}
    >
      <Card
        className="mx-auto w-full max-w-155.75 p-6 shadow-[0_3px_12px_-4px_rgb(0_0_0/0.035),0_1px_2px_rgb(0_0_0/0.01)] sm:p-8"
      >
        <AppForm<FormAnswerValues, FormAnswerValues, SubmissionResult | void>
          className="flex flex-col gap-10"
          defaultValues={defaultValues}
          id={preview ? "form-editor-preview" : "public-form"}
          schema={schema}
          submitFn={async (values) => {
            const result = await submitFn(values)
            if (result && !preview) {
              if (result.redirectUrl) {
                setRedirecting(true)
                window.location.assign(result.redirectUrl)
              } else setSuccess(result)
            }
            return result
          }}
        >
          {(form) => (
            <>
              <FormHeading description={snapshot.description} logo={snapshot.appearance.logo} title={snapshot.title} />
              {snapshot.settings.emailCollection !== "NONE" ? (
                <FormLabel
                  description={snapshot.settings.emailCollection === "OPTIONAL" ? t("public.emailOptional") : undefined}
                  error={form.error("respondentEmail")}
                  errorPlacement="below"
                  label={t("public.email")}
                >
                  <Input {...form.getInputProps("respondentEmail", { type: "email", autoComplete: "email", "aria-required": snapshot.settings.emailCollection === "REQUIRED", "aria-invalid": Boolean(form.error("respondentEmail")) })} size="lg" />
                </FormLabel>
              ) : null}
              {snapshot.sections.map((section) => (
                <section className="flex flex-col gap-10" key={section.id}>
                  {section.title || section.description ? (
                    <header className="space-y-2">
                      {section.title ? <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2> : null}
                      {section.description ? <p className="whitespace-pre-wrap text-muted-foreground">{section.description}</p> : null}
                    </header>
                  ) : null}
                  {section.items.map((item) => <FormItemRenderer form={form} item={item} key={item.id} />)}
                </section>
              ))}
              <div className="flex justify-end">
                <Button className="w-full hover:bg-primary hover:shadow-sm active:bg-primary data-pressed:bg-primary sm:w-auto" disabled={form.formState.isSubmitting || redirecting || Boolean(success)} size="xl" type="submit">
                  {form.formState.isSubmitting || redirecting ? <Spinner /> : null}
                  {snapshot.settings.submitButtonText}
                </Button>
              </div>
            </>
          )}
        </AppForm>
      </Card>
      <Dialog disablePointerDismissal={true} open={Boolean(success)}>
        <DialogPopup
          backdropClassName={cn("bg-background/70 backdrop-blur-md", presentation.className)}
          className={cn("max-w-xl items-center gap-4 overflow-y-auto rounded-none border-0 bg-transparent p-6 text-center outline-none text-foreground shadow-none before:hidden sm:p-8", presentation.className)}
          forceBackdrop={true}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault()
              event.stopPropagation()
            }
          }}
          ref={(element) => { element?.focus() }}
          showCloseButton={false}
          style={presentation.style}
          tabIndex={-1}
        >
          <DialogTitle className="text-2xl leading-tight sm:text-3xl">{t("public.successTitle")}</DialogTitle>
          <DialogDescription className="w-full whitespace-pre-wrap wrap-anywhere text-base leading-relaxed sm:text-lg">
            {success?.successMessage}
          </DialogDescription>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
