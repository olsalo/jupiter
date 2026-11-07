import { useMutation } from "@tanstack/react-query"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { AppForm } from "~/components/forms/app-form"
import FormLabel from "~/components/forms/form-label"
import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { createAuthFormSchemas } from "~/lib/schemas/auth"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import { z } from "~/lib/validation/zod"

export function RequestAccessForm() {
  const { t } = useTranslation("marketing")
  const { t: authT } = useTranslation("auth")
  const trpc = useTRPC()
  const schema = useMemo(() => z.object({
    email: createAuthFormSchemas(authT).sendOtp.shape.email,
  }), [authT])
  const mutation = useMutation(trpc.marketing.requestAccess.mutationOptions({
    onSuccess: () => {
      toast.success(t("accessRequest.successTitle"), t("accessRequest.successDescription"))
    },
    onError: (error) => {
      if (error.data?.zodError) return
      toast.error(t(error.data?.code === "TOO_MANY_REQUESTS" ? "accessRequest.tooManyRequests" : "accessRequest.error"))
    },
  }))

  return (
    <AppForm
      className="w-full gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:gap-3"
      defaultValues={{ email: "" }}
      resetAfterSubmit={true}
      schema={schema}
      submitFn={mutation}
    >
      {(form) => {
        const isSubmitting = form.formState.isSubmitting || mutation.isPending

        return <>
          <FormLabel className="w-full min-w-0 sm:w-72 sm:shrink-0" error={form.error("email")} label={authT("email.label")} labelGroupClassName="sr-only" showError={false}>
            <Input
              {...form.getInputProps("email", {
                "aria-invalid": Boolean(form.error("email")),
                autoComplete: "email",
                disabled: isSubmitting,
                inputMode: "email",
                placeholder: authT("email.placeholder"),
                type: "text",
              })}
              className="h-11 [&_input]:h-full sm:h-10"
            />
          </FormLabel>
          <Button className="w-full text-base sm:w-auto" disabled={isSubmitting} loading={isSubmitting} size="xl" type="submit">
            {t("accessRequest.cta")}<Icon aria-hidden={true} name="arrowRight" />
          </Button>
        </>
      }}
    </AppForm>
  )
}
