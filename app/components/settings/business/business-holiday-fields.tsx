import { useFormScope, type FormApi, type FormScope } from "@rvf/react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import { BusinessHolidayDialog } from "~/components/settings/business/business-holiday-dialog"
import { BusinessHolidayFormFields } from "~/components/settings/business/business-holiday-form-fields"
import Icon from "~/components/icons"
import { SettingsSectionHeader } from "~/components/settings/settings-section-header"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Switch } from "~/components/ui/switch"
import type { BusinessHoliday } from "~/lib/business/business-holidays"
import { calendarDateFromValue } from "~/lib/calendar/date"
import { formatDateTime } from "~/lib/localization/format-preference"
import type { BusinessHolidayValues, BusinessScheduleValues } from "~/lib/schemas/business-schedule"
import type { loader as rootLoader } from "~/root"

export function BusinessHolidayFields({ form, timezone, persistCustomHolidays = true }: { form: FormApi<BusinessScheduleValues>; timezone: string; persistCustomHolidays?: boolean }) {
  const { i18n, t } = useTranslation()
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ open: boolean; holiday?: BusinessHoliday; flow: number }>({ open: false, flow: 0 })
  const holidays = form.getControlProps("holidays")
  const pending = form.formState.isSubmitting
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const formatPreference = root?.formatPreference ?? "eu"
  const displayTime = (minute: number) => formatDateTime(`2000-01-01T${String(Math.floor(minute / 60) % 24).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}:00Z`, { formatPreference, language, timeZone: "UTC", includeDate: false })
  const edit = (holiday?: BusinessHoliday) => setDialog((state) => ({ open: true, holiday, flow: state.flow + 1 }))
  return <>
    <div className="flex items-start justify-between gap-3">
      <SettingsSectionHeader title={t("businessSchedule.holidays")} description={t("businessSchedule.holidaysDescription")} />
      <Button disabled={pending || holidays.value.length >= 100} onClick={() => edit()} size="sm" type="button" variant="outline"><Icon aria-hidden={true} name="plus" size={16} />{t("businessSchedule.addHoliday")}</Button>
    </div>
    <div className="mt-4 divide-y">
      {holidays.value.map((holiday, index) => ({ holiday, index })).sort((a, b) => a.holiday.date.localeCompare(b.holiday.date)).map(({ holiday, index }) => {
        const custom = holiday.id.startsWith("custom-")
        const label = custom ? holiday.name : t(`businessSchedule.defaults.${holiday.id}`, { defaultValue: holiday.labels?.[language] ?? holiday.name })
        const hasError = Boolean(form.error(`holidays[${index}].endMinute`) || form.error(`holidays[${index}].startMinute`))
        const open = holiday.enabled && (expanded === holiday.id || hasError)
        return <div className="py-3" id={holiday.id} key={holiday.id}>
          <div className="flex items-center gap-3">
            <Switch aria-label={t("businessSchedule.enableHoliday", { name: label })} checked={holiday.enabled} disabled={pending} onCheckedChange={(enabled) => form.setValue(`holidays[${index}].enabled`, enabled)} />
            <div className="grid min-w-0 flex-1 gap-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium">{label}</span>
                {holiday.enabled ? <Badge className="shrink-0 max-sm:hidden" size="sm" variant="secondary">{holiday.closed ? t("businessSchedule.closed") : `${displayTime(holiday.startMinute)} – ${displayTime(holiday.endMinute)}`}</Badge> : null}
              </div>
              <span className="text-xs text-muted-foreground">{formatDateTime(calendarDateFromValue(holiday.date, timezone), { formatPreference, language, timeZone: timezone, includeTime: false, includeWeekday: true })}{holiday.endDate && holiday.endDate !== holiday.date ? ` - ${formatDateTime(calendarDateFromValue(holiday.endDate, timezone), { formatPreference, language, timeZone: timezone, includeTime: false, includeWeekday: true })}` : null}</span>
            </div>
            {custom ? <Button aria-label={t("businessSchedule.removeHoliday", { name: label })} disabled={pending} onClick={() => holidays.onChange(holidays.value.filter((_, position) => position !== index))} size="icon-sm" type="button" variant="ghost"><Icon aria-hidden={true} name="trash" size={16} /></Button> : null}
            <Button aria-expanded={custom ? undefined : open} aria-label={t("businessSchedule.editNamedHoliday", { name: label })} disabled={pending || !holiday.enabled} onClick={() => custom ? edit(holiday) : setExpanded(open ? null : holiday.id)} size="icon-sm" type="button" variant="ghost"><Icon aria-hidden={true} name="edit" size={16} /></Button>
          </div>
          {open && !custom ? <div className="mt-4 rounded-lg border bg-muted/15 p-4"><ScopedHolidayFields scope={form.scope(`holidays[${index}]`)} timezone={timezone} /></div> : null}
        </div>
      })}
    </div>
    <BusinessHolidayDialog persist={persistCustomHolidays} flow={dialog.flow} holiday={dialog.holiday} holidays={holidays.value} onOpenChange={(open) => setDialog((state) => ({ ...state, open }))} onSave={(holiday) => {
      const current = form.transient.value()
      if (!persistCustomHolidays) {
        holidays.onChange([...current.holidays.filter((entry) => entry.id !== holiday.id), holiday])
        return
      }
      const baseline = form.transient.defaultValue()
      const update = (entries: BusinessHoliday[]) => [...entries.filter((entry) => entry.id !== holiday.id), holiday].sort((first, second) => first.date.localeCompare(second.date))
      const next = { ...current, holidays: update(current.holidays) }
      const saved = { ...baseline, holidays: update(baseline.holidays) }
      form.resetForm(saved)
      form.setValue("workingHours", next.workingHours)
      form.setValue("breaks", next.breaks)
      form.setValue("holidays", next.holidays)
      for (const field of ["workingHours", "breaks", "holidays"] as const) {
        form.setDirty(field, JSON.stringify(next[field]) !== JSON.stringify(saved[field]))
      }
    }} open={dialog.open} timezone={timezone} />
  </>
}

function ScopedHolidayFields({ scope, timezone }: { scope: FormScope<BusinessHolidayValues>; timezone: string }) {
  const form = useFormScope(scope)
  return <BusinessHolidayFormFields custom={false} form={form} timezone={timezone} />
}
