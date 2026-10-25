import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { FormApi } from "@rvf/react"
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react"
import { Link, useLocation, useNavigate, useRevalidator, useRouteLoaderData } from "react-router"
import type { loader as rootLoader } from "~/root"
import { useTranslation } from "react-i18next"

import { AppForm, type AppFormState } from "~/components/app-form"
import { FormSwitch } from "~/components/form-switch"
import Icon from "~/components/icons"
import FormLabel from "~/components/form-label"
import { PhoneInput } from "~/components/phone-input"
import { ResponsiveSheetPanel, ResponsiveSheetFooter } from "~/components/responsive-sheet"
import { ServiceSelection } from "~/components/services/service-selection"
import { SettingsSectionHeader } from "~/components/settings-section-header"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "~/components/ui/input-group"
import { Separator } from "~/components/ui/separator"
import { Tabs, TabsPanel } from "~/components/ui/tabs"
import { Textarea } from "~/components/ui/textarea"
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip"
import { personFormSchema, type PersonFormFields, type PersonFormInput, type PersonFormValues } from "~/lib/schemas/team"
import { breaksSnapshot } from "~/lib/team-breaks"
import { currentScheduleDate, scheduleAt, type ScheduleRule } from "~/lib/calendar/availability"
import { TeamPanelLoading } from "./team-panel-loading"
import { useTRPC } from "~/lib/trpc/client"
import { toast } from "~/lib/toast"
import { PermissionLevelSelect } from "./permission-level-select"
import { TeamBreaksFields } from "./team-breaks-fields"
import { TeamPersonTimeOff } from "./team-person-time-off"
import { TeamPersonEditHeader } from "./team-person-edit-header"
import { TeamPersonNavigationLayout } from "./team-person-navigation-layout"
import { TeamPersonAccess } from "./team-person-access"
import { TeamWorkingHoursFields } from "./team-working-hours-fields"
import { useBusinessWorkingHours } from "./use-business-working-hours"
import type { TeamPerson } from "./team-types"

export type SettingsPersonFormState = AppFormState & { canSubmit: boolean; isLoading?: boolean }

export function TeamPersonForm({ person, close, onPendingChange, selfSettings = false, settingsTab = "general", onSettingsTabChange, settingsFormApi, settingsResetRef, settingsFormId, onSettingsFormStateChange, generalContent, sideNavigation = false }: {
  sideNavigation?: boolean
  settingsFormApi?: { current: FormApi<PersonFormFields> | null }
  settingsResetRef?: { current: (() => void) | null }
  settingsFormId?: string
  onSettingsFormStateChange?: (state: SettingsPersonFormState) => void
  generalContent?: ReactNode
  selfSettings?: boolean
  settingsTab?: string
  onSettingsTabChange?: (tab: string) => void
  person?: TeamPerson
  close: (destination?: string) => void
  onPendingChange: (pending: boolean) => void
}) {
  const { t } = useTranslation("team")
  const revalidator = useRevalidator()
  const navigate = useNavigate()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const location = useLocation()
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const initialTab = new URLSearchParams(location.search).get("editTab")
  const [localEditTab, setLocalEditTab] = useState(person && (initialTab === "access" || initialTab === "services" || initialTab === "availability" || initialTab === "breaks" || initialTab === "time-off") ? initialTab : "profile")
  const editTab = selfSettings ? settingsTab : localEditTab
  const setEditTab = (tab: string) => {
    if (selfSettings) {
      onSettingsTabChange?.(tab)
      return
    }
    setLocalEditTab(tab)
    if (sideNavigation) {
      const params = new URLSearchParams(location.search)
      params.set("editTab", tab)
      params.set("profileTab", tab === "profile" || tab === "access" ? "about" : tab)
      navigate({ pathname: location.pathname, search: `?${params}` }, { replace: true, state: location.state, preventScrollReset: true })
    }
  }
  const fullHeightServices = !selfSettings && Boolean(person) && editTab === "services"
  const Panel = selfSettings ? "div" : ResponsiveSheetPanel
  const Footer = selfSettings ? "div" : ResponsiveSheetFooter
  const TabsRoot = selfSettings ? "div" : Tabs
  const [formSubmitting, setFormSubmitting] = useState(false)
  const useErrorId = useId()
  const formApi = useRef<FormApi<PersonFormFields>>(null)
  const savedFormValues = useRef<PersonFormFields | null>(null)
  const setFormApi = useCallback((form: FormApi<PersonFormFields> | null) => {
    formApi.current = form
    if (settingsFormApi) settingsFormApi.current = form
  }, [settingsFormApi])
  const create = useMutation(trpc.team.addPerson.mutationOptions())
  const updateOwn = useMutation(trpc.profile.updateTeamProfile.mutationOptions())
  const resetOwnHours = useMutation(trpc.profile.resetTeamWorkingHours.mutationOptions())
  const update = useMutation(trpc.team.updatePerson.mutationOptions())
  const editing = Boolean(person)
  const services = useQuery({ ...trpc.service.list.queryOptions(), enabled: !selfSettings && (!editing || editTab === "services") })
  const organization = useQuery(trpc.organizations.general.queryOptions())
  const serviceItems = (services.data ?? []).filter((service) => service.isActive || person?.staff?.staffServices.some((link) => link.serviceId === service.id))
  const emptyServices = !selfSettings && services.isSuccess && serviceItems.length === 0
  const workingHours = useQuery({ ...trpc.availability.getRules.queryOptions({ staffMemberId: person?.staff?.id ?? "new" }), enabled: Boolean(person?.staff) })
  const businessHours = useBusinessWorkingHours()
  const personalHours = workingHours.data?.filter((rule) => rule.locationId === null)
  const at = currentScheduleDate(businessHours.timezone)
  const defaultHours = scheduleAt<ScheduleRule>(businessHours.hours, at).map(({ dayOfWeek, startMinute, endMinute, isActive }) => ({ dayOfWeek, startMinute, endMinute, timezone: businessHours.timezone, validFrom: null, validUntil: null, isActive }))
  const hoursSource = personalHours?.length ? personalHours : (workingHours.isSuccess || !person?.staff) && !businessHours.isPending && !businessHours.isError ? businessHours.hours : undefined
  const loadedHours = hoursSource ? scheduleAt<ScheduleRule>(hoursSource, at).map(({ dayOfWeek, startMinute, endMinute, isActive }) => ({ dayOfWeek, startMinute, endMinute, timezone: businessHours.timezone, validFrom: null, validUntil: null, isActive })) : undefined
  const breaksQuery = useQuery({ ...trpc.availability.getBreaks.queryOptions({ staffMemberId: person?.staff?.id ?? "new" }), enabled: Boolean(person?.staff) })
  const loadedBreaks = breaksQuery.data ? scheduleAt(breaksQuery.data.filter((rule) => rule.locationId === null), at).map(({ dayOfWeek, startMinute, endMinute, isActive }) => ({ dayOfWeek, startMinute, endMinute, timezone: businessHours.timezone, validFrom: null, validUntil: null, isActive })) : undefined
  const initialBreaks = useRef(breaksSnapshot(loadedBreaks ?? []))
  const breaksInitialized = useRef(Boolean(loadedBreaks) || !person?.staff)
  useEffect(() => {
    const form = formApi.current
    if (loadedBreaks && form && (!breaksInitialized.current || breaksSnapshot(form.transient.value().breaks ?? []) === initialBreaks.current)) {
      breaksInitialized.current = true
      initialBreaks.current = breaksSnapshot(loadedBreaks)
      if (savedFormValues.current) savedFormValues.current = { ...savedFormValues.current, breaks: loadedBreaks }
      form.setValue("breaks", loadedBreaks)
    }
  }, [breaksQuery.data, businessHours.timezone])
  const hoursPending = (Boolean(person?.staff) && workingHours.isPending) || (!personalHours?.length && businessHours.isPending)
  const hoursError = (Boolean(person?.staff) && workingHours.isError) || (!personalHours?.length && businessHours.isError)
  const defaultValues: PersonFormFields = { name: person?.name ?? "", email: person?.member?.user.email ?? person?.email ?? "", phone: person?.phone ?? "", bio: person?.staff?.bio ?? "", timezone: person?.staff?.timezone ?? "", takesAppointments: person ? person.staff?.acceptsAppointments ?? !selfSettings : true, isActive: person?.staff?.isActive ?? true, serviceIds: person?.staff?.staffServices.filter((link) => link.isActive).map((link) => link.serviceId) ?? [], locationIds: person?.staff?.staffLocations.filter((link) => link.isActive).map((link) => link.locationId) ?? [], giveAppAccess: false, role: "member", sendEmail: true, workingHours: loadedHours ?? [], breaks: loadedBreaks ?? [] }
  if (!savedFormValues.current) savedFormValues.current = defaultValues
  useEffect(() => {
    if (!settingsResetRef) return
    settingsResetRef.current = () => {
      if (savedFormValues.current) formApi.current?.resetForm(savedFormValues.current)
    }
    return () => { settingsResetRef.current = null }
  }, [settingsResetRef])
  const initialProfile = useRef(profileSnapshot(defaultValues))
  const initialHours = useRef(JSON.stringify(loadedHours))
  const hoursInitialized = useRef(Boolean(loadedHours))
  useEffect(() => {
    const form = formApi.current
    if (loadedHours && form && (!hoursInitialized.current || JSON.stringify(form.transient.value().workingHours) === initialHours.current)) {
      hoursInitialized.current = true
      initialHours.current = JSON.stringify(loadedHours)
      if (savedFormValues.current) savedFormValues.current = { ...savedFormValues.current, workingHours: loadedHours }
      form.setValue("workingHours", loadedHours)
    }
  }, [workingHours.data, businessHours.hours, businessHours.timezone, businessHours.isPending, businessHours.isError])
  const schema = useMemo(() => personFormSchema(editing, Boolean(person?.staff), { useRequired: t("people.useRequired"), staffRequired: t("people.staffRequired"), endTime: t("people.endTimeError") }, selfSettings), [editing, Boolean(person?.staff), selfSettings, t])
  return (
    <TeamPersonNavigationLayout enabled={sideNavigation && Boolean(person) && !selfSettings} mode="edit" value={editTab} onValueChange={setEditTab} disabled={formSubmitting || update.isPending}>
    <TabsRoot className="contents" {...(selfSettings ? {} : { value: editTab, onValueChange: (value: unknown) => setEditTab(String(value)) })}>
    {person && !selfSettings ? <TeamPersonEditHeader person={person} disabled={formSubmitting || update.isPending} sideNavigation={sideNavigation} /> : null}
    {person && !selfSettings ? <TabsPanel className={editTab === "access" ? "flex min-h-0 flex-1 flex-col [&_[data-slot=scroll-area-content]]:flex [&_[data-slot=scroll-area-content]]:min-h-full [&_[data-slot=scroll-area-content]]:flex-col" : "hidden"} keepMounted={true} value="access">
      <TeamPersonAccess person={person} disabled={formSubmitting || update.isPending} />
    </TabsPanel> : null}
    {person && selfSettings ? <PersonFormSection settings={true} editing={true} selectedTab={editTab} tab="time-off">
      {person.staff ? <TeamPersonTimeOff staff={person.staff} canManage={true} self={selfSettings} /> : <Alert><AlertTitle>{t("people.notBookable")}</AlertTitle><AlertDescription>{t("people.noStaffDescription")}</AlertDescription></Alert>}
    </PersonFormSection> : null}
    {person && !selfSettings ? <TabsPanel className={editTab === "time-off" ? "flex min-h-0 flex-1 flex-col [&_[data-slot=scroll-area-content]]:flex [&_[data-slot=scroll-area-content]]:min-h-full [&_[data-slot=scroll-area-content]]:flex-col" : "hidden"} keepMounted={true} value="time-off">
      {person.staff ? <TeamPersonTimeOff staff={person.staff} canManage={true} self={false} /> : <Alert className="m-6"><AlertTitle>{t("people.notBookable")}</AlertTitle><AlertDescription>{t("people.noStaffDescription")}</AlertDescription></Alert>}
    </TabsPanel> : null}
    <AppForm<PersonFormInput, PersonFormValues, unknown, PersonFormFields, PersonFormFields>
      className="contents"
      ref={setFormApi}
      id={settingsFormId}
      defaultValues={defaultValues}
      schema={schema}
      disableFocusOnError={editing}
      onFormStateChange={(state) => setFormSubmitting(state.isSubmitting)}
      onBeforeSubmit={() => formApi.current?.unstable_setCustomError("email", null)}
      onInvalidSubmit={() => {
        const result = schema.safeParse(formApi.current?.transient.value())
        if (!result.success) {
          const [field, index, key] = result.error.issues[0]?.path ?? []
          setEditTab(field === "breaks" ? "breaks" : field === "workingHours" ? "availability" : field === "serviceIds" || field === "locationIds" ? selfSettings ? "appointments" : "services" : selfSettings && field === "takesAppointments" ? "appointments" : selfSettings ? "general" : "profile")
          requestAnimationFrame(() => {
            if ((field === "workingHours" || field === "breaks") && typeof index === "number") {
              const input = key === "startMinute" ? "startMinute" : key === "dayOfWeek" ? "dayOfWeek" : "endMinute"
              formApi.current?.focus(`${field}[${index}].${input}`)
            } else if (typeof field === "string") {
              formApi.current?.focus(field as keyof PersonFormFields)
            }
          })
        }
      }}
      submitFn={async (values) => {
        onPendingChange(true)
        try {
          const payload = { ...values, workingHours: hoursInitialized.current && JSON.stringify(values.workingHours) !== initialHours.current ? values.workingHours : undefined, breaks: breaksInitialized.current && breaksSnapshot(values.breaks ?? []) !== initialBreaks.current ? values.breaks : undefined }
          const result = person ? await (selfSettings ? updateOwn.mutateAsync(payload) : update.mutateAsync({ id: person.id, ...payload })) : await create.mutateAsync(values)
          const invitationOnly = "invitationId" in result && result.personId === null
          if (!person) close(invitationOnly ? "/team?tab=invites" : undefined)
          await Promise.all([
            queryClient.invalidateQueries(trpc.team.list.queryFilter()), queryClient.invalidateQueries(trpc.team.count.queryFilter()),
            queryClient.invalidateQueries(trpc.resourceLimits.getAll.queryFilter()),
            queryClient.invalidateQueries(trpc.team.getPerson.queryFilter()), queryClient.invalidateQueries(trpc.profile.getTeamProfile.queryFilter()), queryClient.invalidateQueries(trpc.staff.list.queryFilter()),
            queryClient.invalidateQueries(trpc.appointment.list.queryFilter()), queryClient.invalidateQueries(trpc.appointment.get.queryFilter()), queryClient.invalidateQueries(trpc.availability.calendarSchedule.queryFilter()),
            queryClient.invalidateQueries(trpc.availability.getRules.queryFilter()), queryClient.invalidateQueries(trpc.availability.getBreaks.queryFilter()), queryClient.invalidateQueries(trpc.availability.getSlots.queryFilter()),
          ])
          if (selfSettings) {
            await revalidator.revalidate()
            const currentForm = formApi.current
            if (currentForm) {
              const savedValues = currentForm.transient.value()
              savedFormValues.current = savedValues
              currentForm.resetForm(savedValues)
              initialProfile.current = profileSnapshot(savedValues)
            }
            initialHours.current = JSON.stringify(values.workingHours)
            initialBreaks.current = breaksSnapshot(values.breaks ?? [])
          }
          if (person && !selfSettings) await navigate({ pathname: "..", search: `?profileTab=${editTab === "profile" || editTab === "access" ? "about" : editTab}` }, { relative: "path", replace: true, state: location.state })
          toast.success(t(person ? "people.saved" : invitationOnly ? "people.invitationCreated" : "people.added"))
          return result
        } catch (error) {
          const appCode = (error as { data?: { appCode?: string } }).data?.appCode
          if (appCode === "RESOURCE_LIMIT_REACHED") {
            const limit = (error as { data?: { resourceLimit?: { limit: number } } }).data?.resourceLimit?.limit
            toast.error(t("common:settings.teamMemberLimitReached", { count: limit }))
          } else if (appCode && ["alreadyStaff", "alreadyMember", "alreadyInvited", "alreadyLinked", "pendingInvitation"].includes(appCode)) {
            const messages: Record<string, string> = { alreadyStaff: t("people.alreadyStaff"), alreadyMember: t("invite.alreadyMember"), alreadyInvited: t("invite.alreadyInvited"), alreadyLinked: t("people.alreadyLinked"), pendingInvitation: t("people.pendingEmail") }
            setEditTab(selfSettings ? "general" : "profile")
            formApi.current?.unstable_setCustomError("email", messages[appCode])
          } else if (!(error as { data?: { zodError?: unknown } }).data?.zodError) toast.error(t("people.saveFailed"))
          throw error
        } finally { onPendingChange(false) }
      }}
    >
      {(form) => {
        const bookable = form.getControlProps("takesAppointments")
        const access = form.getControlProps("giveAppAccess")
        const sendEmail = form.getControlProps("sendEmail")
        const role = form.getControlProps("role")
        const serviceIds = form.getControlProps("serviceIds")
        const phone = form.getControlProps("phone")
        const useError = !editing && !bookable.value && !access.value ? form.error("takesAppointments") : undefined
        const values = form.value()
        const hasEdits = profileSnapshot(values) !== initialProfile.current || (
          hoursInitialized.current && JSON.stringify(values.workingHours) !== initialHours.current
        ) || (breaksInitialized.current && breaksSnapshot(values.breaks ?? []) !== initialBreaks.current)
        const canSubmit = !services.isLoading && !((editTab === "availability" || editTab === "breaks") && (hoursPending || hoursError)) && !(editTab === "breaks" && Boolean(person?.staff) && (breaksQuery.isPending || breaksQuery.isError))
        const viewLoading = services.isLoading || ((editTab === "availability" || editTab === "breaks") && hoursPending) || (editTab === "breaks" && Boolean(person?.staff) && breaksQuery.isPending)
        const servicesLoading = !selfSettings && services.isLoading && (!editing || editTab === "services")
        const panelLoading = editing && !selfSettings && ((editTab === "availability" || editTab === "breaks") && hoursPending || editTab === "breaks" && Boolean(person?.staff) && breaksQuery.isPending)
        const fullHeightPanel = fullHeightServices || panelLoading
        const submitting = form.formState.isSubmitting || update.isPending || updateOwn.isPending || resetOwnHours.isPending
        return <>
          {selfSettings ? <SettingsFormStateObserver isDirty={hasEdits} isSubmitting={submitting} canSubmit={canSubmit} isLoading={viewLoading} onChange={onSettingsFormStateChange} /> : null}
          <div className={editTab === "time-off" || (editTab === "access" && !selfSettings) ? "hidden" : "contents"}>
          {editing && !selfSettings && (editTab === "profile" || editTab === "services" || editTab === "availability" || editTab === "breaks") ? <div className="shrink-0 px-6 pt-6 pb-5"><SettingsSectionHeader title={t(editTab === "profile" ? "people.contact" : editTab === "services" ? "people.services" : editTab === "availability" ? "people.availability" : "people.breaks")} description={t(editTab === "profile" ? "people.contactSettingsDescription" : editTab === "services" ? "people.profileServicesDescription" : editTab === "availability" ? "people.editHoursDescription" : "people.breaksDescription")} /></div> : null}
          {servicesLoading ? <ResponsiveSheetPanel className="relative flex min-h-0 flex-1" scrollable={false}>
            <TeamPanelLoading label={t("people.loadingServices")} />
          </ResponsiveSheetPanel> : <Panel {...(!selfSettings ? { scrollable: !fullHeightPanel } : {})} className={selfSettings ? "flex min-h-0 flex-1 flex-col" : fullHeightPanel ? "flex min-h-0 flex-1 flex-col overflow-hidden p-0!" : editing ? "flex min-h-full flex-1 flex-col p-0!" : "flex flex-col gap-5"}>
            <PersonFormSection settings={selfSettings} editing={editing} selectedTab={editTab} tab={selfSettings ? "general" : "profile"}>
            <FormLabel label={t("name")} description={selfSettings ? t("people.selfNameDescription") : undefined} error={form.error("name")}><Input {...form.getInputProps("name")} aria-invalid={Boolean(form.error("name"))} autoComplete="name" placeholder={t("invite.namePlaceholder")} type="text" /></FormLabel>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormLabel className={!selfSettings && !bookable.value && !person?.staff ? "sm:col-span-2" : undefined} label={t("email")} description={selfSettings ? t("people.selfEmailDescription") : undefined} error={form.error("email")}>
                {selfSettings || person?.member ? (
                  <InputGroup>
                    <InputGroupInput {...form.getInputProps("email")} aria-invalid={Boolean(form.error("email")) || undefined} disabled={true} autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={t("invite.placeholder")} type="text" inputMode="email" />
                    <InputGroupAddon align="inline-end">
                      <Tooltip>
                        <TooltipTrigger aria-label={t("people.emailLocked")} render={<span className="inline-flex cursor-default" tabIndex={0} />}>
                          <Icon aria-hidden={true} name="lock" />
                        </TooltipTrigger>
                        <TooltipPopup>{t("people.emailLocked")}</TooltipPopup>
                      </Tooltip>
                    </InputGroupAddon>
                  </InputGroup>
                ) : (
                  <Input {...form.getInputProps("email")} aria-invalid={Boolean(form.error("email"))} disabled={Boolean(person?.member)} autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={t("invite.placeholder")} type="text" inputMode="email" />
                )}
              </FormLabel>
              {selfSettings || bookable.value || person?.staff ? <FormLabel label={t("people.phone")} error={form.error("phone")}><PhoneInput value={phone.value} onChange={phone.onChange} onBlur={phone.onBlur} name={phone.name} ref={phone.ref} country={organization.data?.location} disabled={organization.isPending} invalid={Boolean(form.error("phone"))} placeholder={t("people.phonePlaceholder")} /></FormLabel> : null}
            </div>
            {selfSettings ? <Separator /> : null}
            {selfSettings ? generalContent : null}
            {selfSettings ? null : <Separator />}
            {selfSettings ? null : <>
            {editing ? <SettingsSectionHeader title={t("people.appointments")} description={t("people.bookingSettingsDescription")} /> : null}
            <FormSwitch label={t("people.takesAppointments")} description={t("people.bookableDescription")} error={editing ? form.error("takesAppointments") : useError} showError={editing} aria-describedby={useError ? useErrorId : undefined} checked={bookable.value} onCheckedChange={(checked) => {
              bookable.onChange(checked)
              if (!checked && !person) {
                form.setValue("phone", "")
                form.setValue("bio", "")
                form.setValue("serviceIds", [])
                form.setValue("locationIds", [])
              }
            }} onBlur={bookable.onBlur} ref={bookable.ref} name={bookable.name} />
            {editing && (bookable.value || person?.staff) ? <FormLabel label={t("people.bio")} description={t("people.bioDescription")} error={form.error("bio")}><Textarea {...form.getInputProps("bio")} placeholder={t("people.bioPlaceholder")} aria-invalid={Boolean(form.error("bio"))} /></FormLabel> : null}
            </>}
            </PersonFormSection>
            {selfSettings ? <PersonFormSection settings={true} editing={true} selectedTab={editTab} tab="appointments">
              <FormSwitch label={t("people.takesAppointments")} description={t("people.bookableDescription")} error={form.error("takesAppointments")} checked={bookable.value} onCheckedChange={bookable.onChange} onBlur={bookable.onBlur} ref={bookable.ref} name={bookable.name} />
              <FormLabel label={t("people.bio")} description={t("people.bioDescription")} error={form.error("bio")}><Textarea {...form.getInputProps("bio")} placeholder={t("people.bioPlaceholder")} aria-invalid={Boolean(form.error("bio"))} /></FormLabel>
            </PersonFormSection> : null}
            {!selfSettings ? <PersonFormSection settings={false} editing={editing} selectedTab={editTab} tab="services">
            {bookable.value || person?.staff ? <>
              <FormLabel className={editing ? "min-h-0 flex-1 items-stretch" : undefined} label={t("people.services")} labelGroupClassName={editing ? "sr-only" : undefined} description={editing ? undefined : t("people.servicesDescription")} error={form.error("serviceIds")} errorPlacement="below">
                <ServiceSelection className={editing ? undefined : "h-80 flex-none"} label={t("people.services")} services={serviceItems} value={serviceIds.value} onChange={serviceIds.onChange} onBlur={serviceIds.onBlur} inputRef={serviceIds.ref} disabled={submitting || services.isError} invalid={Boolean(form.error("serviceIds"))} />
                {emptyServices ? <Button className="w-fit" onClick={() => navigate("/services/new")} type="button" variant="outline"><Icon aria-hidden={true} name="add" size={16} />{t("people.addService")}</Button> : null}
              </FormLabel>
              {(services.isError) ? <Alert variant="error"><AlertTitle>{t("people.optionsError")}</AlertTitle><AlertDescription>{t("retryDescription")}</AlertDescription></Alert> : null}
              {!editing ? <FormLabel label={t("people.bio")} description={t("people.bioDescription")} error={form.error("bio")}><Textarea {...form.getInputProps("bio")} placeholder={t("people.bioPlaceholder")} aria-invalid={Boolean(form.error("bio"))} /></FormLabel> : null}
            </> : <Alert><AlertTitle>{t("people.notBookable")}</AlertTitle><AlertDescription>{t("people.noStaffDescription")}</AlertDescription></Alert>}
            </PersonFormSection> : null}
            {editing ? <PersonFormSection settings={selfSettings} editing={true} selectedTab={editTab} tab="availability">
              {selfSettings ? <SettingsSectionHeader title={t("people.availability")} description={t("people.editHoursDescription")} /> : null}
              {hoursPending ? <div className="relative min-h-0 flex-1"><TeamPanelLoading label={t("people.loadingAvailability")} /></div> : hoursError ? <Alert variant="error"><AlertTitle>{t("people.availabilityError")}</AlertTitle><AlertDescription>{t("retryDescription")}</AlertDescription><AlertAction><Button disabled={workingHours.isFetching || businessHours.isFetching} onClick={() => void Promise.all([workingHours.refetch(), businessHours.refetch()])} type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : bookable.value || person?.staff ? <TeamWorkingHoursFields showHeader={false} scope={form.scope()} defaultHours={defaultHours} resetPending={resetOwnHours.isPending} onResetToDefault={selfSettings ? async (hours) => {
                try {
                  await resetOwnHours.mutateAsync()
                  formApi.current?.setValue("workingHours", hours)
                  initialHours.current = JSON.stringify(hours)
                  if (savedFormValues.current) savedFormValues.current = { ...savedFormValues.current, workingHours: hours }
                  await Promise.all([
                    queryClient.invalidateQueries(trpc.availability.getRules.queryFilter()),
                    queryClient.invalidateQueries(trpc.availability.calendarSchedule.queryFilter()),
                    queryClient.invalidateQueries(trpc.appointment.list.queryFilter()),
                    queryClient.invalidateQueries(trpc.appointment.get.queryFilter()),
                  ])
                  toast.success(t("people.hoursRestored"))
                } catch {
                  toast.error(t("people.restoreHoursFailed"))
                }
              } : undefined} timezone={businessHours.timezone} /> : <Alert><AlertTitle>{t("people.notBookable")}</AlertTitle><AlertDescription>{t("people.noStaffDescription")}</AlertDescription></Alert>}
            </PersonFormSection> : null}
            {editing ? <PersonFormSection settings={selfSettings} editing={true} selectedTab={editTab} tab="breaks">
              {selfSettings ? <SettingsSectionHeader title={t("people.breaks")} description={t("people.breaksDescription")} /> : null}
              {hoursPending || (person?.staff && breaksQuery.isPending) ? <div className="relative min-h-0 flex-1"><TeamPanelLoading label={t("people.loadingBreaks")} /></div> : hoursError || (person?.staff && breaksQuery.isError) ? <Alert variant="error"><AlertTitle>{t("people.breaksError")}</AlertTitle><AlertDescription>{t("retryDescription")}</AlertDescription><AlertAction><Button disabled={breaksQuery.isFetching || workingHours.isFetching || businessHours.isFetching} onClick={() => void Promise.all([breaksQuery.refetch(), workingHours.refetch(), businessHours.refetch()])} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert> : bookable.value || person?.staff ? <TeamBreaksFields showHeader={false} scope={form.scope()} timezone={businessHours.timezone} /> : <Alert><AlertTitle>{t("people.notBookable")}</AlertTitle><AlertDescription>{t("people.noStaffDescription")}</AlertDescription></Alert>}
            </PersonFormSection> : null}
            {!editing ? <>
              <Separator />
              <FormSwitch label={t("people.giveAppAccess")} description={t("people.accessDescription")} error={form.error("giveAppAccess") || useError} showError={!useError} aria-describedby={useError ? useErrorId : undefined} checked={access.value} onCheckedChange={access.onChange} onBlur={access.onBlur} ref={access.ref} name={access.name} />
              {access.value ? <>
                <FormLabel label={t("permissionLevel")} error={form.error("role")}>
                  <PermissionLevelSelect value={role.value} onValueChange={role.onChange} name={role.name} invalid={Boolean(form.error("role"))} disabled={form.formState.isSubmitting} onBlur={role.onBlur} ref={role.ref} />
                </FormLabel>
                <FormSwitch label={t("invite.sendEmail")} description={t(sendEmail.value ? "invite.sendEmailOnDescription" : "invite.sendEmailOffDescription")} error={form.error("sendEmail")} checked={sendEmail.value} onCheckedChange={sendEmail.onChange} onBlur={sendEmail.onBlur} ref={sendEmail.ref} name={sendEmail.name} />
              </> : null}
            </> : null}
            {useError ? <Alert id={useErrorId} variant="error"><AlertDescription>{useError}</AlertDescription></Alert> : null}
          </Panel>}
          </div>
          {!selfSettings ? <Footer className="shrink-0">
            <Button disabled={submitting} onClick={selfSettings ? () => formApi.current?.resetForm() : person ? undefined : () => close()} render={person && !selfSettings ? <Link to={{ pathname: "..", search: `?profileTab=${editTab === "profile" || editTab === "access" ? "about" : editTab}` }} relative="path" replace={true} state={location.state} onClick={(event) => { if (submitting) event.preventDefault() }} /> : undefined} type="button" variant="ghost">{t("cancel")}</Button>
            <Button disabled={submitting} loading={submitting} type="submit">{t(submitting ? "people.saving" : person ? "people.save" : "people.add")}</Button>
          </Footer> : null}
        </>
      }}
    </AppForm>
    </TabsRoot>
    </TeamPersonNavigationLayout>
  )
}

function PersonFormSection({ editing, settings = false, selectedTab, tab, children }: { settings?: boolean; editing: boolean; selectedTab: string; tab: string; children: ReactNode }) {
  if (settings) return <TabsPanel className={selectedTab === tab ? "relative flex flex-1 flex-col gap-5" : "hidden"} keepMounted={true} value={tab}>{children}</TabsPanel>
  return editing ? <TabsPanel className={selectedTab === tab ? "relative flex min-h-0 flex-1 flex-col gap-5 px-6 pb-6" : "hidden"} keepMounted={true} value={tab}>{children}</TabsPanel> : <>{children}</>
}

function profileSnapshot({ workingHours, breaks, serviceIds, locationIds, ...values }: PersonFormFields) {
  return JSON.stringify({ ...values, serviceIds: [...serviceIds].sort(), locationIds: [...locationIds].sort() })
}

function SettingsFormStateObserver({ isDirty, isSubmitting, canSubmit, isLoading, onChange }: SettingsPersonFormState & { onChange?: (state: SettingsPersonFormState) => void }) {
  useEffect(() => {
    onChange?.({ isDirty, isSubmitting, canSubmit, isLoading })
  }, [isDirty, isSubmitting, canSubmit, isLoading, onChange])
  useEffect(() => () => onChange?.({ isDirty: false, isSubmitting: false, canSubmit: false }), [onChange])
  return null
}
