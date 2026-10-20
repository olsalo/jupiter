import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { TZDate } from "react-day-picker"
import { useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import { AppForm } from "~/components/app-form"
import { DatePicker } from "~/components/date-picker"
import Icon from "~/components/icons"
import FormLabel from "~/components/form-label"
import { ResponsiveSheetPanel, ResponsiveSheetFooter } from "~/components/responsive-sheet"
import { TeamBreaksFields } from "~/components/team/team-breaks-fields"
import { TeamWorkingHoursFields } from "~/components/team/team-working-hours-fields"
import { TeamPanelLoading } from "~/components/team/team-panel-loading"
import { useBusinessWorkingHours } from "~/components/team/use-business-working-hours"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Select, SelectGroup, SelectGroupLabel, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "~/components/ui/select"
import { scheduleAt, type ScheduleRule } from "~/lib/calendar/availability"
import { calendarDateFromValue, calendarDateToValue } from "~/lib/calendar/date"
import { formatDateTime } from "~/lib/format-preference"
import { calendarAvailabilitySchema, type CalendarAvailabilityFields } from "~/lib/schemas/calendar-availability"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"

export function CalendarWeeklyAvailability({ staffMemberId, kind, onPendingChange, close }: {
  staffMemberId: string
  kind: "workingHours" | "breaks"
  onPendingChange: (pending: boolean) => void
  close: () => void
}) {
  const { t } = useTranslation()
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const business = useBusinessWorkingHours()
  const rules = useQuery(trpc.availability.getRules.queryOptions({ staffMemberId }))
  const breaks = useQuery(trpc.availability.getBreaks.queryOptions({ staffMemberId }))
  const mutation = useMutation(trpc.availability.saveSchedule.mutationOptions())
  const remove = useMutation(trpc.availability.deleteScheduledChange.mutationOptions())
  const [deletingDate, setDeletingDate] = useState<string | null>(null)
  const [editorVersion, setEditorVersion] = useState(0)
  const today = calendarDateToValue(new TZDate(new Date(), business.timezone))
  const [viewDate, setViewDate] = useState(today)
  const [formPending, setFormPending] = useState(false)
  const formId = useId()
  const savedEffectiveFrom = useRef<string | undefined>(undefined)
  const formatOptions = { formatPreference: root?.formatPreference ?? "eu", language: root?.locale === "fi" ? "fi" as const : "en" as const, timeZone: business.timezone, includeTime: false }
  const schema = calendarAvailabilitySchema(t("team:people.endTimeError")).safeExtend({
    effectiveFrom: calendarAvailabilitySchema().shape.effectiveFrom.refine((date) => date >= today, t("calendarAvailability.dateError")),
  })
  const personalHours = rules.data?.filter((rule) => rule.locationId === null) ?? []
  const personalBreaks = breaks.data?.filter((rule) => rule.locationId === null) ?? []
  const at = calendarDateFromValue(viewDate, business.timezone)
  const defaultHours = scheduleAt<ScheduleRule>(business.hours, at)
  const hours = scheduleAt<ScheduleRule>(personalHours.length ? personalHours : business.hours, at)
  const initialValues: CalendarAvailabilityFields = { effectiveFrom: viewDate, workingHours: kind === "workingHours" ? hours : [], breaks: kind === "breaks" ? scheduleAt(personalBreaks, at) : [] }
  const upcoming = [...new Set((kind === "workingHours" ? personalHours : personalBreaks).flatMap((rule) => rule.validFrom && +rule.validFrom > +calendarDateFromValue(today, business.timezone) ? [calendarDateToValue(new TZDate(rule.validFrom, business.timezone))] : []))].sort()
  const scheduleItems = [
    { value: today, label: t("calendarAvailability.currentTitle") },
    ...upcoming.map((date) => ({ value: date, label: t("calendarAvailability.from", { date: formatDateTime(calendarDateFromValue(date, business.timezone), formatOptions) }) })),
  ]
  const loading = rules.isPending || (kind === "breaks" && breaks.isPending) || business.isPending
  const failed = rules.isError || (kind === "breaks" && breaks.isError) || business.isError
  const pending = formPending || mutation.isPending || deletingDate !== null
  useEffect(() => { onPendingChange(pending) }, [pending, onPendingChange])
  useEffect(() => () => onPendingChange(false), [onPendingChange])
  const selectVersion = (date: string) => {
    savedEffectiveFrom.current = date > today ? date : undefined
    setViewDate(date)
    setEditorVersion((version) => version + 1)
  }
  const refreshSchedule = () => Promise.all([
    queryClient.invalidateQueries(trpc.availability.getRules.queryFilter()),
    queryClient.invalidateQueries(trpc.availability.getBreaks.queryFilter()),
    queryClient.invalidateQueries(trpc.availability.getSlots.queryFilter()),
    queryClient.invalidateQueries(trpc.availability.getBookingTimes.queryFilter()),
    queryClient.invalidateQueries(trpc.availability.calendarSchedule.queryFilter()),
    queryClient.invalidateQueries(trpc.appointment.list.queryFilter()),
    queryClient.invalidateQueries(trpc.appointment.get.queryFilter()),
  ])
  const deleteChange = async (date: string) => {
    setDeletingDate(date)
    try {
      await remove.mutateAsync({ staffMemberId, kind, effectiveFrom: date })
      await refreshSchedule()
      if (viewDate === date || savedEffectiveFrom.current === date) selectVersion(today)
      toast.success(t("calendarAvailability.deleted"))
    } catch {
      toast.error(t("calendarAvailability.deleteError"))
    } finally {
      setDeletingDate(null)
    }
  }

  return loading ? <div className="relative min-h-0 flex-1"><TeamPanelLoading label={t(kind === "breaks" ? "team:people.loadingBreaks" : "team:people.loadingAvailability")} /></div> : failed ? <ResponsiveSheetPanel>
      <Alert variant="error"><AlertTitle>{t("team:people.availabilityError")}</AlertTitle><AlertDescription>{t("team:retryDescription")}</AlertDescription><AlertAction><Button disabled={rules.isFetching || breaks.isFetching || business.isFetching} onClick={() => void Promise.all([rules.refetch(), breaks.refetch(), business.refetch()])} type="button" variant="outline">{t("team:retry")}</Button></AlertAction></Alert>
    </ResponsiveSheetPanel> : <>
      <AppForm key={editorVersion} className="contents" id={formId} defaultValues={initialValues} schema={schema} onFormStateChange={(state) => setFormPending(state.isSubmitting)} submitFn={async (values) => {
        try {
          await mutation.mutateAsync({ staffMemberId, kind, ...values, previousEffectiveFrom: savedEffectiveFrom.current ?? (viewDate > today ? viewDate : undefined) })
          savedEffectiveFrom.current = values.effectiveFrom > today ? values.effectiveFrom : undefined
          await refreshSchedule()
          setViewDate(values.effectiveFrom)
          toast.success(t("calendarAvailability.saved"))
        } catch (error) {
          if (!(error as { data?: { zodError?: unknown } }).data?.zodError) toast.error(t("calendarAvailability.saveError"))
          throw error
        }
      }}>
        {(form) => {
          return <>
          <ResponsiveSheetPanel>
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormLabel label={t("calendarAvailability.schedule")}>
                  <div className="flex w-full items-center gap-1.5">
                    <Select disabled={pending} items={scheduleItems} onValueChange={(value) => { if (value) selectVersion(value) }} value={viewDate}>
                      <SelectTrigger aria-label={t("calendarAvailability.schedule")} className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
                      <SelectPopup>
                        <SelectItem value={today}>{t("calendarAvailability.currentTitle")}</SelectItem>
                        {upcoming.length ? <SelectGroup><SelectGroupLabel>{t("calendarAvailability.upcoming")}</SelectGroupLabel>{scheduleItems.slice(1).map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectGroup> : null}
                      </SelectPopup>
                    </Select>
                    {viewDate > today ? <Button aria-label={t("calendarAvailability.deleteDate", { date: formatDateTime(calendarDateFromValue(viewDate, business.timezone), formatOptions) })} className="shrink-0 text-destructive-foreground" disabled={pending} loading={deletingDate === viewDate} onClick={() => void deleteChange(viewDate)} size="icon" type="button" variant="ghost"><Icon aria-hidden={true} name="trash" size={16} /></Button> : null}
                  </div>
                </FormLabel>
                <FormLabel label={t("calendarAvailability.effectiveFrom")} error={form.error("effectiveFrom")}>
                  <DatePicker clearLabel={t("team:timeOff.clearDate")} disabled={pending} disablePast={true} formatPreference={formatOptions.formatPreference} inputRef={form.getControlProps("effectiveFrom").ref} invalid={Boolean(form.error("effectiveFrom"))} label={t("calendarAvailability.effectiveFrom")} language={formatOptions.language} onBlur={form.getControlProps("effectiveFrom").onBlur} onChange={(date) => form.setValue("effectiveFrom", date ?? "")} placeholder={t("team:timeOff.chooseDate")} timeZone={business.timezone} value={form.value("effectiveFrom")} />
                </FormLabel>
              </div>
              {kind === "workingHours" ? <TeamWorkingHoursFields defaultHours={defaultHours} scope={form.scope()} showHeader={false} timezone={business.timezone} /> : <TeamBreaksFields scope={form.scope()} workingDays={hours.filter((rule) => rule.isActive).map((rule) => rule.dayOfWeek)} showHeader={false} timezone={business.timezone} />}

            </div>
          </ResponsiveSheetPanel>
          <ResponsiveSheetFooter>
            <Button disabled={pending} onClick={close} type="button" variant="ghost">{t("team:cancel")}</Button>
            <Button disabled={pending} form={formId} loading={formPending} type="submit">{t(formPending ? "team:people.saving" : "team:people.save")}</Button>
          </ResponsiveSheetFooter>
        </>}}
      </AppForm>
    </>
}
