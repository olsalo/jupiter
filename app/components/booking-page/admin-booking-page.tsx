import type { FormApi } from "@rvf/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef, useState, type ChangeEvent } from "react"
import { useTranslation } from "react-i18next"
import { Outlet } from "react-router"
import { AppForm, type AppFormState } from "~/components/forms/app-form"
import FormLabel from "~/components/forms/form-label"
import { AccentColorSelect } from "~/components/settings/preferences/accent-color-select"
import Icon from "~/components/icons"
import { Badge } from "~/components/ui/badge"
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group"
import { ScrollPage } from "~/components/layout/page-layout"
import { RouteHeader } from "~/components/layout/route-header"
import { UserAvatar } from "~/components/data-display/user-avatar"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Separator } from "~/components/ui/separator"
import { Spinner } from "~/components/ui/spinner"
import { Textarea } from "~/components/ui/textarea"
import { adminBookingPageFormSchema, type AdminBookingPageFormValues } from "~/lib/schemas/admin-booking-page"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import { BookingPageSwitch } from "./booking-page-switch"
import { BookingPageFormState } from "./booking-page-form-state"
import { BookingPageChoices } from "./booking-page-choices"
import { BookingPageSection } from "./booking-page-section"

export function AdminBookingPage() {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const query = useQuery(trpc.bookingPage.get.queryOptions())
  const formRef = useRef<FormApi<AdminBookingPageFormValues>>(null)
  const [formState, setFormState] = useState<AppFormState>({ isDirty: false, isSubmitting: false })
  const submitting = formState.isSubmitting
  const mutation = useMutation(trpc.bookingPage.save.mutationOptions())
  const title = t("routeTitles.bookingPage")
  const data = query.data
  const path = data?.publicPath ?? ""
  const initial = useRef<AdminBookingPageFormValues | null>(null)
  if (!initial.current && data) initial.current = adminBookingPageFormSchema.parse(data.values)
  const live = Boolean(data?.published)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href)
      toast.success(t("adminBookingPage.copied"))
    } catch {
      toast.error(t("adminBookingPage.copyError"))
    }
  }

  return <ScrollPage header={<RouteHeader
    title={<span className="inline-flex max-w-full min-w-0 items-center gap-2 md:gap-3"><span className="truncate">{title}</span>{data ? <Badge className={live ? "max-md:size-2 max-md:min-w-0 max-md:rounded-full max-md:border-0 max-md:bg-success max-md:p-0" : "max-md:size-2 max-md:min-w-0 max-md:rounded-full max-md:border-0 max-md:bg-muted-foreground max-md:p-0"} variant={live ? "success" : "secondary"}><span className="max-md:sr-only">{t(live ? "adminBookingPage.live" : "adminBookingPage.offline")}</span></Badge> : null}</span>}
    description={t("routeDescriptions.bookingPage")}
    refreshing={query.isRefetching}
    showDescriptionOnMobile={false}
    actions={<>
      <Button aria-label={t("adminBookingPage.copyLink")} className="max-md:size-9 max-md:p-0" disabled={!data || submitting} onClick={() => void copy()} size="lg" type="button" variant="outline"><Icon aria-hidden={true} name="copy" size={16} /><span className="hidden lg:inline">{t("adminBookingPage.copyLink")}</span></Button>
      <Button aria-label={t("adminBookingPage.openPage")} className="max-md:size-9 max-md:p-0" disabled={!live || submitting} render={<a href={path} rel="noopener noreferrer" target="_blank" />} size="lg" type="button" variant="outline"><Icon aria-hidden={true} name="share" size={16} /><span className="hidden lg:inline">{t("adminBookingPage.openPage")}</span></Button>
      <Button aria-label={t("adminBookingPage.save")} className="max-md:size-9 max-md:p-0" disabled={!data || !formState.isDirty || submitting} form="admin-booking-page" loading={submitting} size="lg" type="submit"><Icon aria-hidden={true} name="save" size={18} /><span className="hidden md:inline">{t("adminBookingPage.save")}</span></Button>
    </>}
  />}>
    <title>{title}</title>
    {query.isError ? <Alert variant="error"><AlertTitle>{t("adminBookingPage.loadError")}</AlertTitle><AlertDescription>{t("adminBookingPage.retryDescription")}</AlertDescription><AlertAction><Button disabled={query.isFetching} onClick={() => void query.refetch()} type="button" variant="outline">{t("adminBookingPage.retry")}</Button></AlertAction></Alert> : !data || !initial.current ? <div className="flex min-h-64 flex-1 items-center justify-center"><Spinner aria-label={t("adminBookingPage.loading")} /></div> : <AppForm<AdminBookingPageFormValues, AdminBookingPageFormValues, AdminBookingPageFormValues>
      className="w-full"
      id="admin-booking-page"
      ref={formRef}
      defaultValues={initial.current}
      schema={adminBookingPageFormSchema}
      submitFn={async (values) => {
        try {
          return await mutation.mutateAsync(values)
        } catch (error) {
          if (!(error as { data?: { zodError?: unknown } }).data?.zodError) toast.error(t("adminBookingPage.saveError"))
          throw error
        }
      }}
      onSubmitSuccess={async (values) => {
        formRef.current?.resetForm(values)
        queryClient.setQueryData(trpc.bookingPage.get.queryKey(), (current) => current ? { ...current, values: { ...current.values, ...values }, publicPath: `/book/${encodeURIComponent(current.organization.slug)}/${encodeURIComponent(values.slug)}`, published: current.bookingEnabled && current.values.isActive } : current)
        toast.success(t("adminBookingPage.saved"))
        await Promise.all([
          queryClient.invalidateQueries(trpc.bookingPage.get.queryFilter()),
          queryClient.invalidateQueries(trpc.booking.getPage.queryFilter()),
          queryClient.invalidateQueries(trpc.organizations.getCurrent.queryFilter()),
        ])
      }}
    >{(form) => {
      const text = (name: "title" | "description" | "successMessage") => {
        const control = form.getControlProps(name)
        const props = { name: control.name, value: control.value, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => control.onChange(event.target.value), onBlur: control.onBlur, ref: control.ref, "aria-invalid": Boolean(form.error(name)) }
        return <FormLabel label={t(`adminBookingPage.${name}`)} error={form.error(name)}>
          {name === "title" ? <Input {...props} placeholder={data.organization.name} type="text" /> : <Textarea {...props} rows={4} />}
        </FormLabel>
      }
      return <fieldset className="flex min-w-0 flex-col gap-7 md:gap-0" disabled={submitting}>
        <BookingPageFormState form={form} saved={adminBookingPageFormSchema.parse(data.values)} onChange={setFormState} />
        <div className="min-w-0 md:order-1 [&>section:first-child]:pt-0">
          <BookingPageSection title={t("adminBookingPage.general")} description={t("adminBookingPage.generalDescription")}>
            <div className="flex items-center gap-3">
              <UserAvatar className="size-10 shrink-0 rounded-lg" decorative={true} name={data.organization.name} src={data.organization.logo} stableId={data.organization.slug} />
              <div className="min-w-0"><p className="truncate text-sm font-medium">{data.organization.name}</p><p className="text-xs leading-5 text-muted-foreground">{t("adminBookingPage.businessBranding")}</p></div>
            </div>
            {!data.bookingEnabled ? <Alert variant="info"><AlertDescription>{t("adminBookingPage.bookingDisabled")}</AlertDescription></Alert> : null}
            <BookingPageSwitch name="isActive" checked={data.values.isActive} disabled={submitting} />
            {text("title")}
            {text("description")}
            <FormLabel label={t("adminBookingPage.accentColor")} description={t("adminBookingPage.accentColorDescription")} error={form.error("accentColor")}>
              <AccentColorSelect
                disabled={submitting}
                inputRef={form.getControlProps("accentColor").ref}
                invalid={Boolean(form.error("accentColor"))}
                label={t("adminBookingPage.accentColor")}
                name={form.getControlProps("accentColor").name}
                onBlur={form.getControlProps("accentColor").onBlur}
                onChange={form.getControlProps("accentColor").onChange}
                value={form.value("accentColor")}
              />
            </FormLabel>
            <FormLabel label={t("adminBookingPage.url")} description={t("adminBookingPage.urlDescription")} error={form.error("slug")}>
              <InputGroup>
                <InputGroupInput name={form.getControlProps("slug").name} value={form.value("slug")} onChange={(event) => form.getControlProps("slug").onChange(event.target.value)} onBlur={form.getControlProps("slug").onBlur} ref={form.getControlProps("slug").ref} aria-invalid={Boolean(form.error("slug"))} autoCapitalize="none" autoComplete="off" spellCheck={false} type="text" />
                <InputGroupAddon className="max-w-[60%] text-sm text-muted-foreground"><span className="truncate">/book/{data.organization.slug}/</span></InputGroupAddon>
              </InputGroup>
            </FormLabel>
          </BookingPageSection>
          <Separator />
          <BookingPageSection title={t("adminBookingPage.services")} description={t("adminBookingPage.servicesDescription")}>
            <BookingPageChoices {...form.getControlProps("serviceIds")} inputRef={form.getControlProps("serviceIds").ref} label={t("adminBookingPage.visibleServices")} description={t("adminBookingPage.serviceSelectionHint")} items={data.services} error={form.error("serviceIds")} disabled={submitting} ordered={true} />
            {data.services.length === 0 ? <Alert variant="info"><AlertDescription>{t("adminBookingPage.noServices")}</AlertDescription></Alert> : null}
          </BookingPageSection>
          <Separator />
          <BookingPageSection title={t("adminBookingPage.staff")} description={t("adminBookingPage.staffDescription")}>
            <BookingPageChoices {...form.getControlProps("staffIds")} inputRef={form.getControlProps("staffIds").ref} label={t("adminBookingPage.visibleStaff")} description={t("adminBookingPage.staffSelectionHint")} items={data.staff} error={form.error("staffIds")} disabled={submitting} />
            <BookingPageSwitch name="allowStaffSelection" checked={data.values.allowStaffSelection} disabled={submitting} />
          </BookingPageSection>
          <Separator />
          <BookingPageSection title={t("adminBookingPage.confirmation")} description={t("adminBookingPage.confirmationDescription")}>
            {text("successMessage")}
          </BookingPageSection>
        </div>
      </fieldset>
    }}</AppForm>}
    <Outlet />
  </ScrollPage>
}
