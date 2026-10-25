import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import { AppForm } from "~/components/forms/app-form"
import { BusinessHolidayFormFields } from "~/components/settings/business/business-holiday-form-fields"
import Icon from "~/components/icons"
import { SettingsSectionHeader } from "~/components/settings/settings-section-header"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from "~/components/ui/dialog"
import { Spinner } from "~/components/ui/spinner"
import { readBusinessExceptions, type BusinessHoliday } from "~/lib/business/business-holidays"
import { calendarDateFromValue } from "~/lib/calendar/date"
import { formatDateTime } from "~/lib/localization/format-preference"
import { generateId } from "~/lib/database/id"
import { businessExceptionSchema, type BusinessHolidayValues } from "~/lib/schemas/business-schedule"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import type { loader as rootLoader } from "~/root"

export function BusinessOpeningExceptions({ timezone, disabled }: { timezone: string; disabled: boolean }) {
  const { t } = useTranslation()
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const organization = useQuery(trpc.organizations.getCurrent.queryOptions())
  const entries = readBusinessExceptions(organization.data?.settings?.businessHolidays)
  const [dialog, setDialog] = useState<{ open: boolean; entry?: BusinessHoliday; flow: number }>({ open: false, flow: 0 })
  const [submitting, setSubmitting] = useState(false)
  const language = root?.locale === "fi" ? "fi" : "en"
  const formatPreference = root?.formatPreference ?? "eu"
  const refresh = () => Promise.all([
    queryClient.invalidateQueries(trpc.organizations.getCurrent.queryFilter()),
    queryClient.invalidateQueries(trpc.availability.pathFilter()),
    queryClient.invalidateQueries(trpc.booking.pathFilter()),
    queryClient.invalidateQueries(trpc.appointment.pathFilter()),
  ])
  const save = useMutation(trpc.organizations.saveBusinessException.mutationOptions({
    onError: (error) => { if (!error.data?.zodError) toast.error(t("settings.saveError")) },
  }))
  const remove = useMutation(trpc.organizations.removeBusinessException.mutationOptions({
    onSuccess: refresh,
    onError: () => toast.error(t("settings.saveError")),
  }))
  const pending = disabled || submitting || save.isPending || remove.isPending
  const edit = (entry?: BusinessHoliday) => setDialog((state) => ({ open: true, entry, flow: state.flow + 1 }))
  const formatTime = (minute: number) => formatDateTime(new Date(Date.UTC(2000, 0, 1, 0, minute)), { formatPreference, language, timeZone: "UTC", includeDate: false })
  const schema = businessExceptionSchema.superRefine((value, ctx) => {
    if (entries.some((entry) => entry.id !== value.id && entry.date === value.date)) ctx.addIssue({ code: "custom", path: ["date"], message: t("businessExceptions.dateTaken") })
  })
  return <section className="mt-6 border-t pt-6">
    <div className="flex items-start justify-between gap-3">
      <SettingsSectionHeader description={t("businessExceptions.description")} title={t("businessExceptions.title")} />
      <Button disabled={pending || entries.length >= 100} onClick={() => edit()} size="sm" type="button" variant="outline"><Icon aria-hidden={true} className="size-4" name="plus" />{t("businessExceptions.add")}</Button>
    </div>
    {entries.length === 0 ? <Alert className="mt-4"><AlertDescription>{t("businessExceptions.empty")}</AlertDescription></Alert> : <ul className="mt-4 divide-y">{entries.map((entry) => <li className="flex items-center gap-3 py-3" key={entry.id}>
      <div className="grid min-w-0 flex-1 gap-1">
        <span className="truncate text-sm font-medium">{entry.name}</span>
        <span className="text-xs text-muted-foreground">{formatDateTime(calendarDateFromValue(entry.date, timezone), { formatPreference, language, timeZone: timezone, includeTime: false, includeWeekday: true })}</span>
      </div>
      <Badge className="shrink-0" size="sm" variant="secondary">{entry.closed ? t("businessSchedule.closed") : `${formatTime(entry.startMinute)} – ${formatTime(entry.endMinute)}`}</Badge>
      <Button aria-label={t("businessExceptions.editNamed", { name: entry.name })} disabled={pending} onClick={() => edit(entry)} size="icon-sm" type="button" variant="ghost"><Icon aria-hidden={true} className="size-4" name="edit" /></Button>
      <Button aria-label={t("businessExceptions.removeNamed", { name: entry.name })} disabled={pending} onClick={() => remove.mutate({ id: entry.id })} size="icon-sm" type="button" variant="ghost"><Icon aria-hidden={true} className="size-4" name="trash" /></Button>
    </li>)}</ul>}
    <Dialog open={dialog.open} onOpenChange={(open) => { if (!pending) setDialog((state) => ({ ...state, open })) }}>
      <DialogPopup className="sm:max-w-md" forceBackdrop={true} onSubmit={(event) => event.stopPropagation()}>
        <DialogHeader><DialogTitle>{t(dialog.entry ? "businessExceptions.edit" : "businessExceptions.add")}</DialogTitle><DialogDescription>{t("businessExceptions.dialogDescription")}</DialogDescription></DialogHeader>
        <AppForm<BusinessHolidayValues, BusinessHolidayValues, unknown>
          className="contents"
          defaultValues={dialog.entry ?? { id: `exception-${generateId()}`, name: "", date: "", enabled: true, closed: true, startMinute: 540, endMinute: 1020 }}
          key={dialog.flow}
          onFormStateChange={(state) => setSubmitting(state.isSubmitting)}
          schema={schema}
          submitFn={async (values) => {
            await save.mutateAsync(values)
            await refresh()
            setDialog((state) => ({ ...state, open: false }))
          }}
        >{(form) => <>
          <DialogPanel><BusinessHolidayFormFields custom={true} form={form} nameLabel={t("businessExceptions.name")} repeatsYearly={false} timezone={timezone} /></DialogPanel>
          <DialogFooter>
            <Button disabled={form.formState.isSubmitting} onClick={() => setDialog((state) => ({ ...state, open: false }))} type="button" variant="ghost">{t("settings.cancel")}</Button>
            <Button disabled={form.formState.isSubmitting} type="submit">{form.formState.isSubmitting ? <Spinner className="size-4" /> : null}{t("settings.save")}</Button>
          </DialogFooter>
        </>}</AppForm>
      </DialogPopup>
    </Dialog>
  </section>
}
