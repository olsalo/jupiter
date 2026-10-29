import { useFormScope, type FormApi } from "@rvf/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { AppForm, type AppFormState } from "~/components/forms/app-form"
import FormLabel from "~/components/forms/form-label"
import { SettingsSwitch } from "~/components/settings/settings-switch"
import Icon from "~/components/icons"
import { SettingsSectionHeader } from "~/components/settings/settings-section-header"
import { Alert, AlertAction, AlertDescription } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Separator } from "~/components/ui/separator"
import { SettingsLoading } from "~/components/settings/settings-loading"
import { communicationsSettingsSchema, type CommunicationsSettingsValues } from "~/lib/schemas/communications"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

export const communicationsSettingsFormId = "communications-settings-form"
const detailsSchema = communicationsSettingsSchema.pick({ senderName: true, replyToAddress: true, reminderOffsetsMinutes: true })
type DetailsValues = Pick<CommunicationsSettingsValues, "senderName" | "replyToAddress" | "reminderOffsetsMinutes">
type ToggleName = "sendBookingConfirmations" | "sendCancellationEmails" | "sendRescheduleEmails" | "enableAppointmentReminders"
const reminderTimingOptions = [60, 120, 180, 360, 720, 1440, 2880, 4320, 10080]

export function CommunicationsSettings({ onFormStateChange, resetRef }: { onFormStateChange: (state: AppFormState) => void; resetRef: { current: (() => void) | null } }) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const query = useQuery(trpc.organizations.communicationsSettings.queryOptions())
  const formRef = useRef<FormApi<DetailsValues>>(null)
  const mutation = useMutation(trpc.organizations.updateCommunicationsSettings.mutationOptions({
    onError: (error) => { if (!error.data?.zodError) toast.error(t("settings.saveError")) },
  }))
  resetRef.current = () => formRef.current?.resetForm()

  if (query.isError) return <Alert variant="error">
    <AlertDescription>{t("settings.loadError")}</AlertDescription>
    <AlertAction>
      <Button disabled={query.isFetching} onClick={() => void query.refetch()} size="sm" type="button" variant="outline">{t("communicationsSettings.retry")}</Button>
    </AlertAction>
  </Alert>
  if (!query.data) return <SettingsLoading />

  return <AppForm<DetailsValues, DetailsValues, CommunicationsSettingsValues>
    defaultValues={detailsSchema.parse(query.data)}
    id={communicationsSettingsFormId}
    onSubmitSuccess={async (saved) => {
      formRef.current?.resetForm(detailsSchema.parse(saved))
      queryClient.setQueryData(trpc.organizations.communicationsSettings.queryKey(), saved)
      await queryClient.invalidateQueries(trpc.organizations.getCurrent.queryFilter())
      toast.success(t("communicationsSettings.saved"))
    }}
    ref={formRef}
    schema={detailsSchema}
    submitFn={(values) => mutation.mutateAsync(values)}
  >{(form) => {
    const busy = form.formState.isSubmitting
    const offsets = form.getControlProps("reminderOffsetsMinutes")
    const timingOptions = [...new Set([...reminderTimingOptions, ...query.data.reminderOffsetsMinutes])].sort((a, b) => a - b).map((minutes) => ({
      value: minutes,
      label: minutes % 1440 === 0 ? t("communicationsSettings.daysBefore", { count: minutes / 1440 }) : minutes % 60 === 0 ? t("communicationsSettings.hoursBefore", { count: minutes / 60 }) : t("communicationsSettings.minutesBefore", { count: minutes }),
    }))
    return <>
      <CommunicationsFormState form={form} saved={query.data} onChange={onFormStateChange} />
      <section className="flex flex-col gap-5">
        <SettingsSectionHeader title={t("communicationsSettings.messagesTitle")} description={t("communicationsSettings.messagesDescription")} />
        {(["sendBookingConfirmations", "sendCancellationEmails", "sendRescheduleEmails", "enableAppointmentReminders"] as const).map((name) => <MessageSwitch key={name} name={name} checked={query.data[name]} />)}
      </section>
      <Separator />
      <section className="flex flex-col gap-5">
        <SettingsSectionHeader title={t("communicationsSettings.timingTitle")} description={t("communicationsSettings.timingDescription")} />
        {!query.data.enableAppointmentReminders ? <Alert><AlertDescription>{t("communicationsSettings.remindersOff")}</AlertDescription></Alert> : <div>
          <div className="flex flex-col gap-3">
            {offsets.value.map((value, index) => <div className="flex items-start gap-2" key={index}>
              <FormLabel className="min-w-0 flex-1" label={t("communicationsSettings.reminder", { number: index + 1 })} error={form.error(`reminderOffsetsMinutes[${index}]`) || form.error("reminderOffsetsMinutes")} errorPlacement="below">
                <Select disabled={busy} items={timingOptions} onValueChange={(next) => {
                  if (next === null) return
                  offsets.onChange(offsets.value.map((offset, position) => position === index ? next : offset))
                }} value={value}>
                  <SelectTrigger aria-invalid={Boolean(form.error("reminderOffsetsMinutes") || form.error(`reminderOffsetsMinutes[${index}]`))} className="w-full" onBlur={offsets.onBlur} ref={index === 0 ? offsets.ref : undefined}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectPopup>
                    {timingOptions.map((option) => <SelectItem disabled={option.value !== value && offsets.value.includes(option.value)} key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectPopup>
                </Select>
              </FormLabel>
              <Button aria-label={t("communicationsSettings.removeReminder", { number: index + 1 })} className="mt-6" disabled={busy || offsets.value.length === 1} onClick={() => offsets.onChange(offsets.value.filter((_, position) => position !== index))} size="icon" type="button" variant="ghost"><Icon name="trash" /></Button>
            </div>)}
            <Button className="self-start" disabled={busy || offsets.value.length >= 5} onClick={() => {
              const next = [120, 60, 1440, 2880, 10080].find((offset) => !offsets.value.includes(offset)) ?? 30
              offsets.onChange([...offsets.value, next])
            }} size="sm" type="button" variant="outline"><Icon name="plus" />{t("communicationsSettings.addReminder")}</Button>
          </div>
        </div>}
      </section>
      <Separator />
      <section className="flex flex-col gap-5">
        <SettingsSectionHeader title={t("communicationsSettings.senderTitle")} description={t("communicationsSettings.senderDescription")} />
        {(["senderName", "replyToAddress"] as const).map((name) => <FormLabel key={name} label={t(`communicationsSettings.${name}`)} description={t(`communicationsSettings.${name}Description`)} error={form.error(name)}>
          <Input {...form.getInputProps(name)} aria-invalid={Boolean(form.error(name))} autoComplete={name === "senderName" ? "organization" : "email"} disabled={busy} placeholder={t(`communicationsSettings.${name}Placeholder`)} type={name === "replyToAddress" ? "email" : "text"} />
        </FormLabel>)}
      </section>
    </>
  }}</AppForm>
}

function CommunicationsFormState({ form, saved, onChange }: { form: FormApi<DetailsValues>; saved: CommunicationsSettingsValues; onChange: (state: AppFormState) => void }) {
  const detailsForm = useFormScope(form.scope())
  const values = detailsForm.value()
  const isDirty = values.senderName !== saved.senderName || values.replyToAddress !== saved.replyToAddress || JSON.stringify(values.reminderOffsetsMinutes) !== JSON.stringify(saved.reminderOffsetsMinutes)
  const isSubmitting = detailsForm.formState.isSubmitting

  useEffect(() => {
    onChange({ isDirty, isSubmitting })
  }, [isDirty, isSubmitting, onChange])

  return null
}

function MessageSwitch({ name, checked }: { name: ToggleName; checked: boolean }) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const mutation = useMutation(trpc.organizations.updateCommunicationsSettings.mutationOptions())
  const queryKey = trpc.organizations.communicationsSettings.queryKey()

  return <SettingsSwitch
    checked={checked}
    disabled={false}
    label={t(`communicationsSettings.${name}`)}
    description={t(`communicationsSettings.${name}Description`)}
    errorMessage={t("settings.saveError")}
    save={(value) => mutation.mutateAsync({ [name]: value })}
    getChecked={(saved) => saved[name]}
    updateCache={(value) => queryClient.setQueryData(queryKey, (current) => current ? { ...current, [name]: value } : current)}
    onSaved={() => queryClient.invalidateQueries(trpc.organizations.getCurrent.queryFilter())}
  />
}
