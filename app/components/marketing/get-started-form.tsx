import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useNavigation, useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"

import { AppForm } from "~/components/forms/app-form"
import FormLabel from "~/components/forms/form-label"
import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { createAuthFormSchemas } from "~/lib/schemas/auth"
import { toast } from "~/lib/toast"
import { z } from "~/lib/validation/zod"

export function GetStartedForm() {
  const { t } = useTranslation("marketing")
  const { t: authT } = useTranslation("auth")
  const navigate = useNavigate()
  const navigation = useNavigation()
  const rootData = useRouteLoaderData<typeof rootLoader>("root")
  const schema = useMemo(() => {
    const email = createAuthFormSchemas(authT).sendOtp.shape.email
    return z.object({ email: z.string().trim().pipe(z.literal("").or(email)) })
  }, [authT])

  return (
    <AppForm
      className="w-full gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:gap-3"
      defaultValues={{ email: "" }}
      schema={schema}
      submitFn={async ({ email }) => {
        try {
          const path = email ? `/auth?${new URLSearchParams({ email })}` : "/auth"
          if (rootData?.appBaseUrl) window.location.assign(`${rootData.appBaseUrl}${path}`)
          else await navigate(path)
        } catch {
          toast.error(authT("toasts.signInError"))
        }
      }}
    >
      {(form) => {
        const isSubmitting = form.formState.isSubmitting || (
          navigation.state !== "idle" && navigation.location?.pathname === "/auth"
        )

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
            {t("getStarted")}<Icon aria-hidden={true} name="arrowRight" />
          </Button>
        </>
      }}
    </AppForm>
  )
}
