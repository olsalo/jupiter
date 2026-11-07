import type { FormApi } from "@rvf/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef } from "react"
import { useTranslation } from "react-i18next"

import { AppForm, type AppFormState } from "~/components/forms/app-form"
import { BusinessLocationFields } from "~/components/settings/business/business-location-fields"
import { SettingsSectionHeader } from "~/components/settings/settings-section-header"
import { Alert, AlertAction, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { SettingsLoading } from "~/components/settings/settings-loading"
import { businessLocationSchema, type BusinessLocationValues } from "~/lib/schemas/business-location"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

export const businessLocationFormId = "business-location-form"

export function BusinessLocationSettings({ onFormStateChange, resetRef }: {
  onFormStateChange: (state: AppFormState) => void
  resetRef: { current: (() => void) | null }
}) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const query = useQuery(trpc.location.businessDetails.queryOptions())
  const formRef = useRef<FormApi<BusinessLocationValues>>(null)
  const mutation = useMutation(trpc.location.saveBusinessDetails.mutationOptions({
    onError: (error) => { if (!error.data?.zodError) toast.error(t("settings.saveError")) },
  }))
  resetRef.current = () => formRef.current?.resetForm()
  if (query.isError) return <Alert variant="error">
    <AlertDescription>{t("settings.loadError")}</AlertDescription>
    <AlertAction>
      <Button disabled={query.isFetching} loading={query.isFetching} onClick={() => void query.refetch()} size="sm" type="button" variant="outline">{t("businessSchedule.retry")}</Button>
    </AlertAction>
  </Alert>
  if (!query.data) return <SettingsLoading />

  return <AppForm<BusinessLocationValues, BusinessLocationValues, BusinessLocationValues>
    className="gap-5"
    defaultValues={query.data}
    id={businessLocationFormId}
    onFormStateChange={onFormStateChange}
    onSubmitSuccess={async (saved) => {
      formRef.current?.resetForm(saved)
      await Promise.all([
        queryClient.invalidateQueries(trpc.location.pathFilter()),
        queryClient.invalidateQueries(trpc.organizations.getCurrent.queryFilter()),
      ])
    }}
    ref={formRef}
    schema={businessLocationSchema}
    submitFn={(values) => mutation.mutateAsync(values)}
  >{(form) => <>
    <SettingsSectionHeader title={t("businessLocation.title")} description={t("businessLocation.description")} />
    <BusinessLocationFields form={form} />
  </>}</AppForm>
}
