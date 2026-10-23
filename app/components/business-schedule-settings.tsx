import type { FormApi } from "@rvf/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Temporal } from "@js-temporal/polyfill"
import { useRef } from "react"
import { useTranslation } from "react-i18next"

import { BusinessOpeningExceptions } from "~/components/business-opening-exceptions"
import { AppForm, type AppFormState } from "~/components/app-form"
import { SettingsSectionHeader } from "~/components/settings-section-header"
import { TeamWorkingHoursFields } from "~/components/team/team-working-hours-fields"
import { useBusinessWorkingHours } from "~/components/team/use-business-working-hours"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { TabsPanel } from "~/components/ui/tabs"
import { upcomingBusinessHolidays } from "~/lib/business-holidays"
import { BusinessHolidayFields } from "~/components/business-holiday-fields"
import { businessScheduleSchema, type BusinessScheduleValues } from "~/lib/schemas/business-schedule"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

export const businessScheduleFormId = "business-schedule-form"

export function BusinessScheduleSettings({ onFormStateChange, onTabChange, resetRef }: {
  onTabChange: (tab: string) => void
  onFormStateChange: (state: AppFormState) => void
  resetRef: { current: (() => void) | null }
}) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const business = useBusinessWorkingHours()
  const organization = useQuery(trpc.organizations.getCurrent.queryOptions())
  const formRef = useRef<FormApi<BusinessScheduleValues>>(null)
  const mutation = useMutation(trpc.organizations.updateBusinessSchedule.mutationOptions({ onError: () => toast.error(t("settings.saveError")) }))
  resetRef.current = () => formRef.current?.resetForm()
  if (business.isError || organization.isError) return <Alert variant="error"><AlertDescription>{t("settings.loadError")}</AlertDescription><Button onClick={() => void Promise.all([business.refetch(), organization.refetch()])} type="button" variant="outline">{t("businessSchedule.retry")}</Button></Alert>
  if (business.isPending || !organization.data) return <div className="flex flex-1 items-center justify-center"><Spinner aria-label={t("settings.loading")} /></div>
  const hours = business.hours.map(({ dayOfWeek, startMinute, endMinute, isActive }) => ({ dayOfWeek, startMinute, endMinute, isActive, timezone: business.timezone, validFrom: null, validUntil: null }))
  return <AppForm<BusinessScheduleValues, BusinessScheduleValues, unknown>
    className="flex flex-1 flex-col"
    defaultValues={{ workingHours: hours, breaks: [], holidays: upcomingBusinessHolidays(organization.data.settings?.businessHolidays, Temporal.Now.plainDateISO(business.timezone).toString()) }}
    disableFocusOnError={true}
    id={businessScheduleFormId}
    onFormStateChange={onFormStateChange}
    onInvalidSubmit={() => {
      const result = businessScheduleSchema.safeParse(formRef.current?.transient.value())
      if (!result.success) onTabChange(result.error.issues[0]?.path[0] === "workingHours" ? "opening-hours" : "holidays")
    }}
    onSubmitSuccess={async () => {
      const values = formRef.current?.transient.value()
      if (values) formRef.current?.resetForm(values)
      await Promise.all([
        queryClient.invalidateQueries(trpc.organizations.getCurrent.queryFilter()),
        queryClient.invalidateQueries(trpc.availability.pathFilter()),
        queryClient.invalidateQueries(trpc.booking.pathFilter()),
      ])
    }}
    ref={formRef}
    schema={businessScheduleSchema}
    submitFn={(values) => mutation.mutateAsync(values)}
  >{(form) => <>
    <TabsPanel className="m-0" keepMounted={true} value="opening-hours">
      <SettingsSectionHeader title={t("businessSchedule.openingHours")} description={t("businessSchedule.hoursDescription")} />
      <div className="mt-4"><TeamWorkingHoursFields defaultHours={[1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startMinute: 480, endMinute: 1080, isActive: true, timezone: business.timezone }))} showReset={false} scope={form.scope()} showHeader={false} timezone={business.timezone} /></div>
      <BusinessOpeningExceptions disabled={form.formState.isSubmitting} timezone={business.timezone} />
    </TabsPanel>
    <TabsPanel className="m-0" keepMounted={true} value="holidays">
      <BusinessHolidayFields form={form} timezone={business.timezone} />
    </TabsPanel>
  </>}</AppForm>
}

