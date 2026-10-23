import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useNavigate, useNavigation } from "react-router"

import { OnboardingActions } from "~/components/onboarding/onboarding-actions"
import { AppForm } from "~/components/app-form"
import { BusinessHolidayFields } from "~/components/business-holiday-fields"
import Icon from "~/components/icons"
import { TeamWorkingHoursFields } from "~/components/team/team-working-hours-fields"
import { Button } from "~/components/ui/button"
import { businessScheduleSchema, type BusinessScheduleValues } from "~/lib/schemas/business-schedule"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import { z } from "~/lib/zod"

const availabilitySchema = z.object({
  workingHours: businessScheduleSchema.shape.workingHours,
  breaks: businessScheduleSchema.shape.breaks,
  holidays: businessScheduleSchema.shape.holidays,
})

export function OnboardingScheduleForm({ defaultValues, nextStep, step }: {
  defaultValues: BusinessScheduleValues & { timezone: string }
  nextStep: "business" | "availability" | "holidays" | "subscription" | null
  step: "availability" | "holidays"
}) {
  const { t } = useTranslation("onboarding")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const availability = useMutation(trpc.onboarding.saveAvailability.mutationOptions())
  const holidays = useMutation(trpc.onboarding.confirmHolidays.mutationOptions())

  return <>
    <div className="flex flex-col gap-1.5">
      <h1 className="text-2xl font-semibold">{t(`${step}.title`)}</h1>
      <p className="text-sm text-muted-foreground">{t(`${step}.description`)}</p>
    </div>
    <AppForm<BusinessScheduleValues, BusinessScheduleValues, unknown>
      className="flex flex-col gap-5"
      defaultValues={defaultValues}
      key={step}
      otherFormProps={{ noValidate: true }}
      schema={step === "availability" ? availabilitySchema : businessScheduleSchema}
      submitFn={async (values) => {
        try {
          if (step === "availability") await availability.mutateAsync(values)
          else await holidays.mutateAsync(values)
        } catch (error) {
          toast.error(t("errors.create"))
          throw error
        }
        await queryClient.invalidateQueries({ queryKey: trpc.onboarding.pathKey(), refetchType: "none" })
        await navigate(nextStep ? `/onboarding/${nextStep}` : "/?welcome=true", { replace: true })
      }}
    >{(form) => <>
      {step === "availability" ? <TeamWorkingHoursFields defaultHours={defaultValues.workingHours} scope={form.scope()} showHeader={false} showReset={false} timezone={defaultValues.timezone} /> : <BusinessHolidayFields form={form} persistCustomHolidays={false} timezone={defaultValues.timezone} />}
      <OnboardingActions>
        <Button loading={form.formState.isSubmitting || navigation.state !== "idle"} type="submit">
          {t(nextStep ? "actions.create" : "actions.finishSetup")}
          <Icon aria-hidden={true} name="chevronRight" size={16} />
        </Button>
      </OnboardingActions>
    </>}</AppForm>
  </>
}
