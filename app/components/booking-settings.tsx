import type { FormApi } from "@rvf/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { AppForm, type AppFormState } from "~/components/app-form"
import FormLabel from "~/components/form-label"
import { SettingsSectionHeader } from "~/components/settings-section-header"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput } from "~/components/ui/number-field"
import { Separator } from "~/components/ui/separator"
import { Spinner } from "~/components/ui/spinner"
import { Switch } from "~/components/ui/switch"
import { bookingWindowSchema, type BookingSettingsValues, type BookingWindowValues } from "~/lib/schemas/booking-settings"
import { createSettingsSaveQueue } from "~/lib/settings-save-queue"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

export const bookingSettingsFormId = "booking-settings-form"

export function BookingSettings({ onFormStateChange, resetRef }: {
  onFormStateChange: (state: AppFormState) => void
  resetRef: { current: (() => void) | null }
}) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const query = useQuery(trpc.organizations.bookingSettings.queryOptions())
  const formRef = useRef<FormApi<BookingWindowValues>>(null)
  const mutation = useMutation(trpc.organizations.updateBookingSettings.mutationOptions({
    onError: (error) => { if (!error.data?.zodError) toast.error(t("settings.saveError")) },
  }))
  resetRef.current = () => formRef.current?.resetForm()

  if (query.isError) return <Alert variant="error">
    <AlertDescription>{t("settings.loadError")}</AlertDescription>
    <Button disabled={query.isFetching} onClick={() => void query.refetch()} type="button" variant="outline">{t("bookingSettings.retry")}</Button>
  </Alert>
  if (!query.data) return <div className="flex flex-1 items-center justify-center"><Spinner aria-label={t("settings.loading")} /></div>

  return <AppForm<BookingWindowValues, BookingWindowValues, BookingSettingsValues>
    defaultValues={bookingWindowSchema.parse(query.data)}
    id={bookingSettingsFormId}
    onSubmitSuccess={async (saved) => {
      formRef.current?.resetForm(bookingWindowSchema.parse(saved))
      queryClient.setQueryData(trpc.organizations.bookingSettings.queryKey(), (current) => current ? { ...current, ...bookingWindowSchema.parse(saved) } : saved)
      await Promise.all([
        queryClient.invalidateQueries(trpc.organizations.getCurrent.queryFilter()),
        queryClient.invalidateQueries(trpc.availability.pathFilter()),
      ])
    }}
    ref={formRef}
    schema={bookingWindowSchema}
    submitFn={(values) => mutation.mutateAsync(values)}
  >{(form) => <BookingSettingsFields
    busy={form.formState.isSubmitting}
    form={form}
    onFormStateChange={onFormStateChange}
    settings={query.data}
  />}</AppForm>
}

type ToggleName = "bookingEnabled" | "allowCustomerCancellation" | "allowCustomerRescheduling" | "requireCustomerEmail" | "requireCustomerPhone"
type NumberName = "minBookingNoticeMinutes" | "maxBookingAdvanceDays" | "cancellationNoticeMinutes" | "rescheduleNoticeMinutes"

function BookingSettingsFields({ busy, form, onFormStateChange, settings }: {
  busy: boolean
  form: FormApi<BookingWindowValues>
  onFormStateChange: (state: AppFormState) => void
  settings: BookingSettingsValues
}) {
  const { t, i18n } = useTranslation()
  const isDirty = (Object.keys(bookingWindowSchema.shape) as NumberName[]).some((name) => !Object.is(form.value(name), settings[name]))
  useEffect(() => {
    onFormStateChange({ isDirty, isSubmitting: busy })
  }, [isDirty, busy, onFormStateChange])
  const toggle = (name: ToggleName) => <BookingSettingSwitch name={name} checked={settings[name]} />
  const number = (name: NumberName) => {
    const control = form.getControlProps(name)
    return <FormLabel description={t(`bookingSettings.${name}Description`)} error={form.error(name)} label={t(`bookingSettings.${name}`)}>
      <NumberField disabled={busy} format={{ maximumFractionDigits: 0, useGrouping: false }} locale={i18n.language} max={name === "maxBookingAdvanceDays" ? 730 : 525600} min={name === "maxBookingAdvanceDays" ? 1 : 0} name={name} onValueChange={(value) => {
        control.onChange(value === null && name !== "maxBookingAdvanceDays" ? Number.NaN : value)
        form.unstable_setCustomError(name, null)
      }} step={name === "maxBookingAdvanceDays" ? 1 : 5} value={Number.isNaN(control.value) ? null : control.value}>
        <NumberFieldGroup>
          <NumberFieldDecrement aria-label={t("bookingSettings.decrease", { field: t(`bookingSettings.${name}`) })} />
          <NumberFieldInput aria-invalid={Boolean(form.error(name))} onBlur={control.onBlur} placeholder={name === "maxBookingAdvanceDays" ? t("bookingSettings.noLimit") : undefined} ref={control.ref} />
          <NumberFieldIncrement aria-label={t("bookingSettings.increase", { field: t(`bookingSettings.${name}`) })} />
        </NumberFieldGroup>
      </NumberField>
    </FormLabel>
  }

  return <>
    {toggle("bookingEnabled")}
    <Separator />
    <section className="flex flex-col gap-5">
      <SettingsSectionHeader title={t("bookingSettings.windowTitle")} description={t("bookingSettings.windowDescription")} />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{number("minBookingNoticeMinutes")}{number("maxBookingAdvanceDays")}</div>
    </section>
    <Separator />
    <section className="flex flex-col gap-5">
      <SettingsSectionHeader title={t("bookingSettings.changesTitle")} description={t("bookingSettings.changesDescription")} />
      {toggle("allowCustomerCancellation")}
      {settings.allowCustomerCancellation ? number("cancellationNoticeMinutes") : null}
      {toggle("allowCustomerRescheduling")}
      {settings.allowCustomerRescheduling ? number("rescheduleNoticeMinutes") : null}
    </section>
    <Separator />
    <section className="flex flex-col gap-5">
      <SettingsSectionHeader title={t("bookingSettings.customerTitle")} description={t("bookingSettings.customerDescription")} />
      {toggle("requireCustomerEmail")}
      {toggle("requireCustomerPhone")}
    </section>
  </>
}

function BookingSettingSwitch({ name, checked }: { name: ToggleName; checked: boolean }) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const queryKey = trpc.organizations.bookingSettings.queryKey()
  const queue = useRef(createSettingsSaveQueue())
  const revision = useRef(0)
  const confirmed = useRef(checked)
  const mutation = useMutation(trpc.organizations.updateBookingSettings.mutationOptions())

  const save = (value: boolean) => {
    if (queue.current.pendingCount === 0) confirmed.current = checked
    const currentRevision = ++revision.current
    queryClient.setQueryData(queryKey, (current) => current ? { ...current, [name]: value } : current)
    void queue.current.enqueue(async () => {
      try {
        const saved = await mutation.mutateAsync({ [name]: value })
        confirmed.current = saved[name]
        if (currentRevision !== revision.current) return
        queryClient.setQueryData(queryKey, (current) => current ? { ...current, [name]: saved[name] } : saved)
        await Promise.all([
          queryClient.invalidateQueries(trpc.organizations.getCurrent.queryFilter()),
          queryClient.invalidateQueries(trpc.availability.pathFilter()),
        ])
      } catch {
        if (currentRevision !== revision.current) return
        queryClient.setQueryData(queryKey, (current) => current ? { ...current, [name]: confirmed.current } : current)
        toast.error(t("settings.saveError"))
      }
    })
  }

  return <FormLabel className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1" description={t(`bookingSettings.${name}Description`)} descriptionClassName="col-start-1 row-start-2" label={t(`bookingSettings.${name}`)}>
    <Switch checked={checked} className="col-start-2 row-span-2 row-start-1" disabled={false} onCheckedChange={save} />
  </FormLabel>
}
