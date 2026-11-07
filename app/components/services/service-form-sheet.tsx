import type { FormApi } from "@rvf/react"
import { useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useLocation, useSearchParams } from "react-router"
import { AppForm } from "~/components/forms/app-form"
import FormLabel from "~/components/forms/form-label"
import { ColorPicker, colorPickerPalette } from "~/components/forms/color-picker"
import { FormSwitch } from "~/components/forms/form-switch"
import { ResponsiveSheetPanel, ResponsiveSheetFooter } from "~/components/overlays/responsive-sheet"
import { RouteFormSheet } from "~/components/overlays/route-form-sheet"
import { ServiceCategoryNameDialog } from "~/components/services/service-category-name-dialog"
import { ServiceCategoryPicker } from "~/components/services/service-category-picker"
import { SettingsSectionHeader } from "~/components/settings/settings-section-header"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput } from "~/components/ui/number-field"
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "~/components/ui/select"
import { OverlayLoading } from "~/components/overlays/overlay-loading"
import { Separator } from "~/components/ui/separator"
import { Textarea } from "~/components/ui/textarea"
import { serviceFormSchema, type ServiceFormInput, type ServiceFormValues } from "~/lib/schemas/services"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import { useAppContext } from "~/lib/hooks/use-app-context"

const defaultValues: ServiceFormInput = {
  name: "", categoryId: "", description: "", durationMinutes: "60", bufferBeforeMinutes: "0", bufferAfterMinutes: "0",
  price: "", deliveryType: "IN_PERSON", color: "#8f49b5", isActive: true, staffIds: [], locationIds: [],
}

export function ServiceFormSheet({ serviceId }: { serviceId?: string }) {
  const [searchParams] = useSearchParams()
  const duplicateId = serviceId ? undefined : searchParams.get("duplicate") ?? undefined
  return <ServiceFormSession key={serviceId ?? duplicateId ?? "new"} serviceId={serviceId} duplicateId={duplicateId} initialCategoryId={searchParams.get("category") ?? ""} />
}

function ServiceFormSession({ serviceId, duplicateId, initialCategoryId }: { serviceId?: string; duplicateId?: string; initialCategoryId: string }) {
  const { t, i18n } = useTranslation("services")
  const trpc = useTRPC()
  const readOnly = Boolean(useAppContext().subscriptionReadOnly)
  const queryClient = useQueryClient()
  const staff = useQuery(trpc.staff.list.queryOptions())
  const locations = useQuery(trpc.location.list.queryOptions())
  const categories = useQuery(trpc.service.categories.queryOptions())
  const organization = useQuery(trpc.organizations.general.queryOptions())
  const editing = Boolean(serviceId)
  const sourceId = serviceId ?? duplicateId
  const service = useQuery({ ...trpc.service.get.queryOptions({ id: sourceId ?? "" }), enabled: Boolean(sourceId) })
  const initialValues = useRef<ServiceFormInput | null>(null)
  const update = useMutation(trpc.service.update.mutationOptions())
  const create = useMutation(trpc.service.create.mutationOptions())
  const schema = useMemo(() => serviceFormSchema((key) => t(key)), [t])
  if (!initialValues.current && (sourceId ? service.data : staff.isSuccess)) {
    const data = service.data
    initialValues.current = data && sourceId ? {
      name: duplicateId ? t("duplicateName", { name: data.name }).slice(0, 120) : data.name, categoryId: data.categoryId ?? "", description: data.description ?? "",
      durationMinutes: String(data.durationMinutes), bufferBeforeMinutes: String(data.bufferBeforeMinutes), bufferAfterMinutes: String(data.bufferAfterMinutes),
      price: data.price === null ? "" : String(data.price), deliveryType: data.deliveryType, color: data.color ?? "#8f49b5", isActive: data.isActive,
      staffIds: data.staffServices.filter((assignment) => assignment.isActive).map((assignment) => assignment.staffMemberId),
      locationIds: data.serviceLocations.filter((assignment) => assignment.isActive).map((assignment) => assignment.locationId),
    } : { ...defaultValues, categoryId: initialCategoryId, staffIds: (staff.data ?? []).filter((person) => person.isActive && person.acceptsAppointments).map((person) => person.id) }
  }
  const staffItems = (staff.data ?? []).filter((person) => (person.isActive && person.acceptsAppointments) || initialValues.current?.staffIds.includes(person.id)).map((person) => ({ value: person.id, label: person.name }))
  const deliveryItems = (["IN_PERSON", "ONLINE", "PHONE", "FLEXIBLE"] as const).map((value) => ({ value, label: t(value) }))
  const location = useLocation()
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [categoryFlow, setCategoryFlow] = useState(0)
  const formApi = useRef<FormApi<ServiceFormInput>>(null)
  const returnParams = new URLSearchParams(location.search)
  returnParams.delete("duplicate")
  const defaultReturnTo = `/services${returnParams.size ? `?${returnParams}` : ""}`
  const destination = useRef(typeof location.state?.returnTo === "string" && location.state.returnTo.startsWith("/services?") ? location.state.returnTo : defaultReturnTo)
  const onReopen = () => {
    setSaved(false)
    setSubmitting(false)
    create.reset()
    update.reset()
    initialValues.current = null
  }
  const pending = submitting || create.isPending || update.isPending || saved
  const disabled = pending || readOnly
  const optionsError = staff.isError || locations.isError || organization.isError
  const initialQuery = sourceId ? service : staff

  const categoryOptions = [...(categories.data ?? [])]
  if (service.data?.category && !categoryOptions.some((category) => category.id === service.data?.categoryId)) categoryOptions.push(service.data.category)

  return (
    <RouteFormSheet closeLabel={t("close")} description={t(editing ? "editDescription" : "createDescription")} onReopen={onReopen} pending={pending || categoryOpen} returnTo={destination.current} title={t(editing ? "editTitle" : "createTitle")}>{(close) => <>
        {initialValues.current ? <AppForm<ServiceFormInput, ServiceFormValues, unknown>
          ref={formApi}
          className="contents"
          defaultValues={initialValues.current}
          schema={schema}
          onFormStateChange={(state) => setSubmitting(state.isSubmitting)}
          submitFn={async (values) => {
            try {
              const source = duplicateId ? service.data : undefined
              const result = serviceId ? await update.mutateAsync({ ...values, id: serviceId }) : await create.mutateAsync({
                ...values,
                locationIds: (locations.data ?? []).filter((location) => location.isActive).slice(0, 1).map((location) => location.id),
                ...(source ? {
                  currency: source.currency,
                  minBookingNoticeMinutes: source.minBookingNoticeMinutes,
                  maxBookingAdvanceDays: source.maxBookingAdvanceDays,
                  cancellationNoticeMinutes: source.cancellationNoticeMinutes,
                  rescheduleNoticeMinutes: source.rescheduleNoticeMinutes,
                  requiresConfirmation: source.requiresConfirmation,
                } : {}),
              })
              // Keep the successful form intact through the closing animation and navigation
              setSaved(true)
              queryClient.setQueryData(trpc.service.list.queryKey(), (previous) => [...(previous ?? []).filter((item) => item.id !== result.id), result].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)))
              void Promise.all([
                queryClient.invalidateQueries(trpc.service.list.queryFilter()),
                queryClient.invalidateQueries(trpc.service.get.queryFilter()),
                queryClient.invalidateQueries(trpc.staff.list.queryFilter()),
                queryClient.invalidateQueries(trpc.team.list.queryFilter()),
                queryClient.invalidateQueries(trpc.staff.get.queryFilter()),
                queryClient.invalidateQueries(trpc.team.getPerson.queryFilter()),
                queryClient.invalidateQueries(trpc.profile.getTeamProfile.queryFilter()),
              ])
              toast.success(t(editing ? "updated" : "created"))
              close()
            } catch (error) {
              const validation = (error as { data?: { zodError?: unknown } }).data?.zodError
              if (!validation) toast.error(t(editing ? "updateError" : "createError"))
              throw error
            }
          }}
        >
          {(form) => {
            const category = form.getControlProps("categoryId")
            const delivery = form.getControlProps("deliveryType")
            const color = form.getControlProps("color")
            const active = form.getControlProps("isActive")
            const staffIds = form.getControlProps("staffIds")
            const number = (name: "durationMinutes" | "bufferBeforeMinutes" | "bufferAfterMinutes" | "price") => {
              const control = form.getControlProps(name)
              const isPrice = name === "price"
              const label = t(name === "durationMinutes" ? "duration" : name)
              const unit = isPrice ? service.data?.currency ?? organization.data?.currency ?? "EUR" : t("minutes")
              return <FormLabel label={`${label} (${unit})`} error={form.error(name)} errorPlacement="below">
                <NumberField
                  disabled={disabled}
                  format={{ maximumFractionDigits: isPrice ? 2 : 0, minimumFractionDigits: isPrice ? 2 : 0, useGrouping: false }}
                  locale={i18n.language}
                  max={isPrice ? 9999999999.99 : name === "durationMinutes" ? 1440 : 240}
                  min={name === "durationMinutes" ? 5 : 0}
                  name={control.name}
                  onValueChange={(value) => {
                    control.onChange(value === null ? "" : isPrice ? value.toFixed(2) : String(value))
                    form.unstable_setCustomError(name, null)
                  }}
                  step={isPrice ? 1 : 5}
                  value={control.value === "" ? null : Number(control.value.replace(",", "."))}
                >
                  <NumberFieldGroup>
                    <NumberFieldDecrement aria-label={t("decrease", { field: label })} />
                    <NumberFieldInput aria-invalid={Boolean(form.error(name))} onBlur={control.onBlur} placeholder={isPrice ? "0" : undefined} ref={control.ref} />
                    <NumberFieldIncrement aria-label={t("increase", { field: label })} />
                  </NumberFieldGroup>
                </NumberField>
              </FormLabel>
            }
            return <>
              <ResponsiveSheetPanel className="flex flex-col gap-5 pb-8!" scrollFade={true}>
                <fieldset className="contents" disabled={disabled}>
                  <SettingsSectionHeader title={t("general")} />
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                    <FormLabel label={t("name")} error={form.error("name")}>
                      <Input {...form.getInputProps("name")} aria-invalid={Boolean(form.error("name"))} autoComplete="off" placeholder={t("namePlaceholder")} type="text" />
                    </FormLabel>
                    <FormLabel label={t("color")} labelClassName="sr-only" error={form.error("color")} errorPlacement="below" className="gap-0">
                      <ColorPicker value={color.value} onChange={color.onChange} onBlur={color.onBlur} name={color.name} ref={color.ref} label={t("color")} colors={colorPickerPalette.map((item) => ({ value: item.value, label: t(`colors.${item.name}`) }))} disabled={disabled} invalid={Boolean(form.error("color"))} />
                    </FormLabel>
                  </div>
                  {categories.isError ? <Alert variant="error"><AlertTitle>{t("categoriesLoadError")}</AlertTitle><AlertDescription>{t("categoriesRetryDescription")}</AlertDescription><AlertAction><Button disabled={categories.isFetching} loading={categories.isFetching} onClick={() => void categories.refetch()} type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : null}
                  <FormLabel label={t("category")} error={form.error("categoryId") === "invalidAssignment" ? t("invalidAssignment") : form.error("categoryId")}>
                    <ServiceCategoryPicker categories={categoryOptions} value={category.value ?? ""} onChange={category.onChange} onBlur={category.onBlur} inputRef={category.ref} disabled={disabled || categories.isPending || categories.isError} invalid={Boolean(form.error("categoryId"))} onCreate={() => {
                      setCategoryFlow((flow) => flow + 1)
                      setCategoryOpen(true)
                    }} />
                  </FormLabel>
                  <FormLabel label={t("description")} error={form.error("description")}>
                    <Textarea {...form.getInputProps("description")} aria-invalid={Boolean(form.error("description"))} placeholder={t("descriptionPlaceholder")} />
                  </FormLabel>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {number("durationMinutes")}
                    {number("price")}
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {number("bufferBeforeMinutes")}
                    {number("bufferAfterMinutes")}
                  </div>
                  <FormLabel label={t("delivery")} error={form.error("deliveryType")}>
                    <Select items={deliveryItems} value={delivery.value} onValueChange={(value) => { if (value) delivery.onChange(value) }} name={delivery.name} disabled={disabled}>
                      <SelectTrigger ref={delivery.ref} onBlur={delivery.onBlur} aria-invalid={Boolean(form.error("deliveryType"))}><SelectValue /></SelectTrigger>
                      <SelectPopup>{deliveryItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectPopup>
                    </Select>
                  </FormLabel>
                  <FormSwitch label={t("showOnBookingPage")} description={t("showOnBookingPageDescription")} checked={active.value} onCheckedChange={active.onChange} onBlur={active.onBlur} ref={active.ref} name={active.name} error={form.error("isActive")} disabled={disabled} />
                  <Separator />
                  <SettingsSectionHeader title={t("serviceTeam")} description={t(staff.isSuccess && staffItems.length === 0 ? "noStaff" : "staffDescription")} />
                  {optionsError ? <Alert variant="error"><AlertTitle>{t("optionsError")}</AlertTitle><AlertDescription>{t("retryDescription")}</AlertDescription><AlertAction><Button disabled={staff.isFetching || locations.isFetching || organization.isFetching} loading={staff.isFetching || locations.isFetching || organization.isFetching} onClick={() => void Promise.all([staff.refetch(), locations.refetch(), organization.refetch()])} type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : null}
                  <FormLabel label={t("staff")} labelGroupClassName="sr-only" errorPlacement="below" error={form.error("staffIds") === "invalidAssignment" ? t("invalidAssignment") : form.error("staffIds")}>
                    <Select multiple={true} items={staffItems} value={staffIds.value} onValueChange={staffIds.onChange} name={staffIds.name} disabled={disabled || staff.isPending || staff.isError || staffItems.length === 0}>
                      <SelectTrigger ref={staffIds.ref} onBlur={staffIds.onBlur} aria-invalid={Boolean(form.error("staffIds"))}><SelectValue placeholder={t(staff.isPending ? "loading" : "chooseStaff")} /></SelectTrigger>
                      <SelectPopup>{staffItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectPopup>
                    </Select>
                  </FormLabel>
                </fieldset>
              </ResponsiveSheetPanel>
              <ResponsiveSheetFooter className="shrink-0">
                <Button disabled={pending} onClick={close} type="button" variant="ghost">{t("cancel")}</Button>
                <Button disabled={disabled || (!editing && !locations.isSuccess)} loading={pending} type="submit">{t(editing ? "saveService" : "create")}</Button>
              </ResponsiveSheetFooter>
            </>
          }}
        </AppForm> : <>
          {initialQuery.isError ? <ResponsiveSheetPanel><Alert variant="error"><AlertTitle>{t(sourceId ? "serviceLoadError" : "optionsError")}</AlertTitle><AlertDescription>{t("listRetryDescription")}</AlertDescription><AlertAction><Button disabled={initialQuery.isFetching} loading={initialQuery.isFetching} onClick={() => void initialQuery.refetch()} type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert></ResponsiveSheetPanel> : <OverlayLoading label={t("loading")} />}
          {initialQuery.isError ? <ResponsiveSheetFooter><Button onClick={close} type="button" variant="ghost">{t("cancel")}</Button></ResponsiveSheetFooter> : null}
        </>}
        <ServiceCategoryNameDialog open={categoryOpen} flow={categoryFlow} onOpenChange={setCategoryOpen} onSaved={(id) => formApi.current?.setValue("categoryId", id)} />
    </>}</RouteFormSheet>
  )
}
