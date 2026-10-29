import type { FormApi } from "@rvf/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef } from "react"
import { useTranslation } from "react-i18next"

import { AppForm, type AppFormState } from "~/components/forms/app-form"
import FormLabel from "~/components/forms/form-label"
import { SettingsSectionHeader } from "~/components/settings/settings-section-header"
import { Alert, AlertAction, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "~/components/ui/select"
import { SettingsLoading } from "~/components/settings/settings-loading"
import countries from "~/lib/localization/data/countries.json"
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
      <Button disabled={query.isFetching} onClick={() => void query.refetch()} size="sm" type="button" variant="outline">{t("businessSchedule.retry")}</Button>
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
  >{(form) => <BusinessLocationFields form={form} />}</AppForm>
}

function BusinessLocationFields({ form }: { form: FormApi<BusinessLocationValues> }) {
  const { t } = useTranslation()
  const country = form.getControlProps("country")
  const items = countries.map((entry) => ({ label: entry.name, value: entry.code.toUpperCase() }))
  const field = (name: Exclude<keyof BusinessLocationValues, "country" | "id">, autoComplete: string, type = "text") => <FormLabel error={form.error(name)} label={t(`businessLocation.${name}`)}>
    <Input {...form.getInputProps(name)} aria-invalid={Boolean(form.error(name))} autoComplete={autoComplete} disabled={form.formState.isSubmitting} type={type} />
  </FormLabel>
  return <>
    <SettingsSectionHeader title={t("businessLocation.title")} description={t("businessLocation.description")} />
    {field("name", "organization")}
    {field("addressLine1", "address-line1")}
    {field("addressLine2", "address-line2")}
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_2fr]">{field("postalCode", "postal-code")}{field("city", "address-level2")}</div>
    <FormLabel error={form.error("country")} label={t("businessLocation.country")}>
      <Select disabled={form.formState.isSubmitting} items={items} onValueChange={(value) => { if (value) country.onChange(value) }} value={country.value}>
        <SelectTrigger aria-invalid={Boolean(form.error("country"))} onBlur={country.onBlur} ref={country.ref}><SelectValue /></SelectTrigger>
        <SelectPopup>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectPopup>
      </Select>
    </FormLabel>
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{field("phone", "tel", "tel")}{field("email", "email", "email")}</div>
  </>
}
