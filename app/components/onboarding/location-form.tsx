import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useNavigate, useNavigation, useSearchParams } from "react-router"

import { AppForm } from "~/components/forms/app-form"
import Icon from "~/components/icons"
import { OnboardingActions } from "~/components/onboarding/onboarding-actions"
import { BusinessLocationFields } from "~/components/settings/business/business-location-fields"
import { Button } from "~/components/ui/button"
import { getAfterOnboardingRedirect } from "~/lib/auth/redirect"
import { onboardingLocationSchema, type OnboardingLocationValues } from "~/lib/schemas/onboarding"
import type { BusinessLocationValues } from "~/lib/schemas/business-location"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

export function OnboardingLocationForm({ defaultValues, nextStep }: {
  defaultValues: BusinessLocationValues
  nextStep: "business" | "location" | "availability" | "holidays" | "subscription" | null
}) {
  const { t } = useTranslation("onboarding")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const [searchParams] = useSearchParams()
  const mutation = useMutation(trpc.onboarding.saveLocation.mutationOptions({
    onError: (error) => { if (!error.data?.zodError) toast.error(t("errors.create")) },
  }))

  return <>
    <div className="flex flex-col gap-1.5">
      <h1 className="text-2xl font-semibold">{t("locationStep.title")}</h1>
      <p className="text-sm text-muted-foreground">{t("locationStep.description")}</p>
    </div>
    <AppForm<BusinessLocationValues, OnboardingLocationValues, unknown>
      className="flex flex-col gap-0"
      defaultValues={defaultValues}
      otherFormProps={{ noValidate: true }}
      schema={onboardingLocationSchema}
      submitFn={async (values) => {
        await mutation.mutateAsync(values)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: trpc.onboarding.pathKey(), refetchType: "none" }),
          queryClient.invalidateQueries(trpc.location.pathFilter()),
        ])
        const search = searchParams.toString()
        await navigate(nextStep ? `/onboarding/${nextStep}${search ? `?${search}` : ""}` : getAfterOnboardingRedirect(searchParams, true), { replace: true })
      }}
    >{(form) => {
      const pending = form.formState.isSubmitting || navigation.state !== "idle"
      return <>
        <div className="flex flex-col gap-3.5">
          <BusinessLocationFields contactLabels={{ phone: t("locationStep.phone"), email: t("locationStep.email") }} form={form} />
        </div>
        <OnboardingActions>
          <Button disabled={pending} loading={pending} type="submit">
            {t(nextStep ? "actions.create" : "actions.finishSetup")}
            <Icon aria-hidden={true} name="chevronRight" size={16} />
          </Button>
        </OnboardingActions>
      </>
    }}</AppForm>
  </>
}
