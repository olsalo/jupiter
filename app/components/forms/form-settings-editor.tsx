import type { FormApi } from "@rvf/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { TRPCClientError } from "@trpc/client"
import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import { AppForm } from "~/components/app-form"
import { DateTimePicker } from "~/components/date-time-picker"
import FormLabel from "~/components/form-label"
import Icon from "~/components/icons"
import { AccentColorSelect } from "~/components/forms/accent-color-select"
import { useFormWorkspaceSaveStatus, useRegisterFormWorkspacePublishValidation, useRegisterFormWorkspaceSave } from "~/components/forms/form-workspace-dialog"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group"
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Skeleton } from "~/components/ui/skeleton"
import { Switch } from "~/components/ui/switch"
import { Textarea } from "~/components/ui/textarea"
import { createFormSettingSchema, formSettingsFieldsSchema, isFormScheduleValid, type FormScheduleSettings, type FormSettingsInput } from "~/lib/forms/schemas/form-settings"
import { createFormSettingsSaveQueue } from "~/lib/forms/form-settings-save-queue"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

type Settings = FormSettingsInput & { timeZone: string, isPublished: boolean }
type SettingField = keyof FormSettingsInput

const settingsGroups: { title: string, fields: SettingField[] }[] = [
  { title: "responses", fields: ["emailCollection", "limitOneResponsePerEmail"] },
  { title: "presentation", fields: ["theme", "accentColor"] },
  { title: "submission", fields: ["submitButtonText", "successMessage", "redirectUrl"] },
  { title: "availability", fields: ["status", "startsAt", "closesAt"] },
]

function settingRowClass(field: SettingField) {
  return field === "status" || field === "limitOneResponsePerEmail"
    ? "relative w-full pr-14"
    : `w-full sm:grid sm:grid-cols-[minmax(0,1fr)_18rem] sm:gap-x-6 ${field === "successMessage" ? "sm:items-start" : "sm:items-center"}`
}

export function FormSettingsSkeleton() {
  const { t } = useTranslation("forms")
  const root = useRouteLoaderData<typeof rootLoader>("root")

  return (
    <div aria-busy={true} aria-label={t("settings.loading")} className="space-y-6">
      {settingsGroups.map((group) => (
        <SettingsGroup key={group.title} title={t(`settings.${group.title}`)}>
          {group.fields.map((field) => (
            <div className="px-4 py-5 sm:px-5" key={field}>
              <FormLabel
                className={settingRowClass(field)}
                description={field === "startsAt" || field === "closesAt"
                  ? <Skeleton aria-hidden={true} className="h-4 w-full max-w-80" />
                  : t(`settings.${field}Description`)}
                descriptionClassName="sm:col-start-1"
                descriptionPlacement="before"
                label={t(`settings.${field}`)}
                labelGroupClassName="flex min-w-0 flex-col gap-1.5"
              >
                {field === "status" || field === "limitOneResponsePerEmail" ? (
                  <Skeleton aria-hidden={true} className="absolute right-0 top-1/2 h-5.5 w-9.5 -translate-y-1/2 rounded-full sm:h-4.5 sm:w-7.5" />
                ) : field === "startsAt" || field === "closesAt" ? (
                  <div aria-hidden={true} className={`grid w-full gap-2 sm:col-start-2 sm:row-start-1 ${root?.formatPreference === "us" ? "grid-cols-[minmax(0,1fr)_7.5rem]" : "grid-cols-[minmax(0,1fr)_6.5rem]"}`}>
                    <Skeleton className="h-9 w-full rounded-lg sm:h-8" />
                    <Skeleton className="h-9 w-full rounded-lg sm:h-8" />
                  </div>
                ) : (
                  <Skeleton aria-hidden={true} className={`w-full rounded-lg sm:col-start-2 sm:row-start-1 ${field === "successMessage" ? "h-24.5" : "h-9 sm:h-8"}`} />
                )}
              </FormLabel>
            </div>
          ))}
        </SettingsGroup>
      ))}
    </div>
  )
}

export function FormSettingsEditor({ formId, settings }: { formId: string, settings: Settings }) {
  const { t } = useTranslation("forms")
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const [schedule, setSchedule] = useState<FormScheduleSettings>({ startsAt: settings.startsAt, closesAt: settings.closesAt })
  const savedScheduleRef = useRef({ startsAt: settings.startsAt, closesAt: settings.closesAt })
  useEffect(() => {
    const previous = savedScheduleRef.current
    setSchedule((current) => {
      const startsAt = current.startsAt === previous.startsAt ? settings.startsAt : current.startsAt
      const closesAt = current.closesAt === previous.closesAt ? settings.closesAt : current.closesAt
      return startsAt === current.startsAt && closesAt === current.closesAt ? current : { startsAt, closesAt }
    })
    savedScheduleRef.current = { startsAt: settings.startsAt, closesAt: settings.closesAt }
  }, [settings.startsAt, settings.closesAt])

  return (
    <div className="space-y-6">
      {settingsGroups.map((group) => (
        <SettingsGroup
          badge={group.title === "availability" && !settings.isPublished ? (
            <Badge title={t("settings.publishFirst")} variant="info">{t("settings.publishFirstBadge")}</Badge>
          ) : undefined}
          key={group.title}
          title={t(`settings.${group.title}`)}
        >
          {group.fields.map((field) => (
            <FormSettingForm field={field} formId={formId} key={field} schedule={schedule} settings={settings}>
              {(form, clearError) => {
                const error = form.error(field)
                const inputError = error ? t(`settings.errors.${error}`, { defaultValue: error }) : undefined
                const description = field === "startsAt" || field === "closesAt"
                  ? t(`settings.${field}Description`, { timeZone: settings.timeZone })
                  : t(`settings.${field}Description`)
                const isSwitch = field === "status" || field === "limitOneResponsePerEmail"
                const disabled = group.title === "availability" && !settings.isPublished
                const rowClass = settingRowClass(field)
                const controlsClass = "sm:col-start-2 sm:row-start-1"
                let control: ReactNode

                if (isSwitch) {
                  const props = form.getControlProps(field)
                  control = (
                    <Switch
                      aria-invalid={Boolean(error) || undefined}
                      checked={props.value}
                      className="absolute right-0 top-1/2 -translate-y-1/2 aria-invalid:ring-2 aria-invalid:ring-destructive"
                      disabled={disabled}
                      inputRef={props.ref}
                      name={props.name}
                      onCheckedChange={(value) => {
                        if (disabled) return
                        clearError()
                        props.onChange(value)
                        form.submit()
                      }}
                    />
                  )
                } else if (field === "emailCollection" || field === "theme") {
                  const props = form.getControlProps(field)
                  const values = field === "emailCollection" ? ["NONE", "OPTIONAL", "REQUIRED"] as const : ["LIGHT", "DARK", "SYSTEM"] as const
                  const items = values.map((value) => ({ label: t(`settings.options.${value}`), value }))
                  control = (
                    <div className={controlsClass}>
                      <Select
                        disabled={false}
                        items={items}
                        name={props.name}
                        onValueChange={(value) => {
                          if (value && values.some((option) => option === value)) {
                            clearError()
                            props.onChange(value as typeof props.value)
                            form.submit()
                          }
                        }}
                        value={props.value}
                      >
                        <SelectTrigger aria-invalid={Boolean(error) || undefined} onBlur={props.onBlur} ref={props.ref}><SelectValue /></SelectTrigger>
                        <SelectPopup>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectPopup>
                      </Select>
                    </div>
                  )
                } else if (field === "accentColor") {
                  const props = form.getControlProps(field)
                  control = (
                    <div className={controlsClass}>
                      <AccentColorSelect
                        disabled={false}
                        inputRef={props.ref}
                        invalid={Boolean(error)}
                        label={t("settings.accentColor")}
                        name={props.name}
                        onBlur={props.onBlur}
                        onChange={(value) => {
                          clearError()
                          props.onChange(value)
                          form.submit()
                        }}
                        value={props.value}
                      />
                    </div>
                  )
                } else if (field === "startsAt" || field === "closesAt") {
                  const props = form.getControlProps(field)
                  control = (
                    <div className={controlsClass}>
                      <DateTimePicker
                        clearLabel={t(`settings.clear.${field}`)}
                        defaultTime={field === "startsAt" ? "00:00" : "23:59"}
                        disabled={disabled}
                        formatPreference={root?.formatPreference ?? "eu"}
                        inputRef={props.ref}
                        invalid={Boolean(error)}
                        label={t(`settings.${field}`)}
                        language={root?.locale === "fi" ? "fi" : "en"}
                        onBlur={props.onBlur}
                        onChange={(value) => {
                          if (disabled) return
                          clearError()
                          props.onChange(value)
                          const nextSchedule = { ...schedule, [field]: value }
                          setSchedule(nextSchedule)
                          if (!isFormScheduleValid(nextSchedule)) {
                            void form.validate()
                            return
                          }
                          form.submit()
                        }}
                        placeholder={t(`settings.empty.${field}`)}
                        timeLabel={t(`settings.time.${field}`)}
                        timeZone={settings.timeZone}
                        value={props.value}
                      />
                    </div>
                  )
                } else {
                  const props = form.getControlProps(field)
                  const nullable = field === "redirectUrl"
                  const shared = {
                    "aria-invalid": Boolean(error) || undefined,
                    name: props.name,
                    onBlur: () => {
                      props.onBlur()
                      if (!formSettingsFieldsSchema.shape[field].safeParse(props.value).success) {
                        void form.validate()
                        return
                      }
                      form.submit()
                    },
                    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                      clearError()
                      props.onChange(nullable && !event.target.value.trim() ? null : event.target.value)
                    },
                    ref: props.ref,
                    value: props.value ?? "",
                  }
                  control = (
                    <div className={controlsClass}>
                      {field === "successMessage" ? <Textarea {...shared} className="min-h-24 resize-y" rows={3} /> : field === "redirectUrl" ? (
                        <InputGroup>
                          <InputGroupInput {...shared} autoComplete="url" inputMode="url" placeholder="https://example.com/thanks" type="text" />
                          <InputGroupAddon align="inline-end">
                            <Button
                              aria-label={t("settings.clear.redirectUrl")}
                              disabled={!props.value}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                clearError()
                                props.onChange(null)
                                form.submit()
                                form.focus(field)
                              }}
                              size="icon-xs"
                              type="button"
                              variant="ghost"
                            >
                              <Icon aria-hidden="true" name="x" size={16} />
                            </Button>
                          </InputGroupAddon>
                        </InputGroup>
                      ) : <Input {...shared} type="text" />}
                    </div>
                  )
                }

                return (
                  <FormLabel
                    className={rowClass}
                    description={description}
                    descriptionClassName="sm:col-start-1"
                    descriptionPlacement="before"
                    error={inputError}
                    errorClassName="sr-only"
                    errorPlacement="below"
                    label={t(`settings.${field}`)}
                    labelGroupClassName="flex min-w-0 flex-col gap-1.5"
                    showError={true}
                  >
                    {control}
                  </FormLabel>
                )
              }}
            </FormSettingForm>
          ))}
        </SettingsGroup>
      ))}
    </div>
  )
}

function SettingsGroup({ badge, children, title }: { badge?: ReactNode, children: ReactNode, title: string }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-xl border border-border">
      <h2 className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-3 text-sm font-medium sm:px-5" id={headingId}>
        <span>{title}</span>
        {badge}
      </h2>
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

function FormSettingForm({ children, field, formId, schedule, settings }: {
  children: (form: FormApi<FormSettingsInput>, clearError: () => void) => ReactNode
  field: SettingField
  formId: string
  schedule: FormScheduleSettings
  settings: Settings
}) {
  const { t } = useTranslation("forms")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const formRef = useRef<FormApi<FormSettingsInput>>(null)
  const schema = useMemo(() => createFormSettingSchema(field, {
    startsAt: schedule.startsAt, closesAt: schedule.closesAt,
  }), [field, schedule.startsAt, schedule.closesAt])
  const saveQueueRef = useRef(createFormSettingsSaveQueue())
  const lastSavedValueRef = useRef(settings[field])
  const saveFailedRef = useRef(false)
  const rejectedValueRef = useRef<{ value: FormSettingsInput[SettingField] | undefined } | null>(null)
  const [serverValidationErrors, setServerValidationErrors] = useState<Record<string, string>>({})
  const clearServerErrors = () => setServerValidationErrors((current) => Object.keys(current).length ? {} : current)
  const clearError = () => {
    rejectedValueRef.current = null
    formRef.current?.clearError(field)
    clearServerErrors()
  }
  const registerSave = useRegisterFormWorkspaceSave()
  const registerPublishValidation = useRegisterFormWorkspacePublishValidation()
  const workspace = useFormWorkspaceSaveStatus()
  const settingsOptions = trpc.forms.settings.get.queryOptions({ id: formId })
  const mutationKey = trpc.forms.settings.update.mutationKey()
  const update = useMutation(trpc.forms.settings.update.mutationOptions({
    onMutate: async () => {
      workspace?.setSaveStatus("pending")
      workspace?.setSaveStatus("saving")
      await queryClient.cancelQueries({ queryKey: settingsOptions.queryKey })
    },
    onSuccess: async (saved) => {
      saveFailedRef.current = false
      rejectedValueRef.current = null
      clearServerErrors()
      lastSavedValueRef.current = saved[field]
      queryClient.setQueryData(settingsOptions.queryKey, (current) => current ? {
        ...current,
        [field]: saved[field],
        draftRevision: Math.max(current.draftRevision, saved.draftRevision),
        ...(field === "emailCollection" || field === "limitOneResponsePerEmail" ? {
          emailCollection: saved.emailCollection, limitOneResponsePerEmail: saved.limitOneResponsePerEmail,
        } : {}),
      } : saved)
      await queryClient.invalidateQueries(trpc.forms.get.queryOptions({ id: formId }))
      void queryClient.invalidateQueries(trpc.publicForms.get.queryOptions({ id: formId }))
    },
    onError: (error, variables) => {
      const errors: Record<string, string[] | undefined> = error.data?.zodError?.fieldErrors ?? {}
      if (!isSettingsValidationError(error)) {
        saveFailedRef.current = true
        workspace?.setSaveStatus("error")
        toast.error(t("settings.saveError"))
        return
      }
      rejectedValueRef.current = { value: variables.settings[field] }
      const currentValue = formSettingsFieldsSchema.shape[field].safeParse(formRef.current?.transient.value(field))
      if (!currentValue.success || currentValue.data !== variables.settings[field]) return
      setServerValidationErrors(Object.fromEntries(Object.entries(errors).flatMap(([key, messages]) => messages?.[0] ? [[key, messages[0]]] : [])))
    },
    onSettled: () => {
      if (saveQueueRef.current.pendingCount === 1 && queryClient.isMutating({ mutationKey }) === 1) {
        if (!saveFailedRef.current) workspace?.setSaveStatus("saved")
        void queryClient.invalidateQueries(settingsOptions)
        void queryClient.invalidateQueries(trpc.forms.list.queryFilter())
        void queryClient.invalidateQueries(trpc.forms.overview.queryFilter())
      }
    },
  }))

  const saveValues = (values: FormSettingsInput) => {
    const value = values[field]
    if (value === rejectedValueRef.current?.value) return Promise.resolve()
    if (value === lastSavedValueRef.current && saveQueueRef.current.pendingCount === 0) {
      if (saveFailedRef.current) {
        saveFailedRef.current = false
        clearServerErrors()
        workspace?.setSaveStatus("saved")
      }
      return Promise.resolve()
    }
    workspace?.setSaveStatus("pending")
    return saveQueueRef.current.enqueue(async () => {
      try {
        await update.mutateAsync({ id: formId, settings: { [field]: value } })
      } catch (error: unknown) {
        if (!isSettingsValidationError(error)) throw error
      }
    })
  }
  const flushRef = useRef(async () => {})
  flushRef.current = async () => {
    const form = formRef.current
    if (!form) return
    await saveQueueRef.current.flush()
    if (saveFailedRef.current) throw new Error("Could not save form settings")
    if (form.transient.value(field) === rejectedValueRef.current?.value) return
    const errors = await form.validate()
    if (Object.keys(errors).length) return
    const values = schema.safeParse(form.transient.value())
    if (!values.success) return
    void saveValues(values.data).catch(() => undefined)
    await saveQueueRef.current.flush()
    if (saveFailedRef.current) throw new Error("Could not save form settings")
  }
  useEffect(() => registerSave?.(() => flushRef.current()), [registerSave])
  useEffect(() => registerPublishValidation?.(async () => {
    const errors = await formRef.current?.validate()
    return !errors || Object.keys(errors).length === 0
  }), [registerPublishValidation])

  const savedValue = settings[field]
  const relatedValue = field === "startsAt" ? schedule.closesAt : field === "closesAt" ? schedule.startsAt : undefined
  useEffect(() => {
    rejectedValueRef.current = null
  }, [savedValue, relatedValue])
  useEffect(() => {
    if (saveQueueRef.current.pendingCount === 0 && !formRef.current?.formState.isSubmitting) {
      const previousSavedValue = lastSavedValueRef.current
      lastSavedValueRef.current = savedValue
      const currentValue = formRef.current?.transient.value(field)
      if (currentValue !== previousSavedValue && currentValue !== savedValue) return
      formRef.current?.setValue(field, savedValue)
    }
  }, [field, savedValue])
  useEffect(() => {
    if (field === "startsAt" || field === "closesAt") void formRef.current?.validate()
  }, [field, schema])

  return (
    <AppForm<FormSettingsInput, FormSettingsInput, void>
      className="px-4 py-5 sm:px-5"
      defaultValues={formSettingsFieldsSchema.parse(settingsWithoutMetadata(settings))}
      disableFocusOnError={true}
      ref={formRef}
      schema={schema}
      onBeforeSubmit={clearServerErrors}
      serverValidationErrors={serverValidationErrors}
      submitFn={(values) => {
        // Keep all controls available while requests save in order.
        void saveValues(values).catch(() => undefined)
      }}
    >
      {(form) => children(form, clearError)}
    </AppForm>
  )
}

function settingsWithoutMetadata(settings: Settings) {
  return Object.fromEntries(Object.keys(formSettingsFieldsSchema.shape).map((field) => [field, settings[field as SettingField]]))
}

function isSettingsValidationError(error: unknown) {
  return error instanceof TRPCClientError && Object.values(error.data?.zodError?.fieldErrors ?? {}).some((messages) => Array.isArray(messages) && messages.length > 0)
}
