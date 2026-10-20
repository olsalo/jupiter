import type { FormApi } from "@rvf/react"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import { DatePicker } from "~/components/date-picker"
import FormLabel from "~/components/form-label"
import { FormSwitch } from "~/components/form-switch"
import { TimePicker } from "~/components/time-picker"
import { Badge } from "~/components/ui/badge"
import { Input } from "~/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "~/components/ui/select"
import type { TimeOffValues } from "~/lib/team-time-off"

export function TeamTimeOffFields({ form, timezone }: { form: FormApi<TimeOffValues>; timezone: string }) {
  const { t } = useTranslation("team")
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const language = root?.locale === "fi" ? "fi" : "en"
  const formatPreference = root?.formatPreference ?? "eu"
  const repeatItems = (["none", "weekly", "monthly", "yearly"] as const).map((value) => ({ value, label: t(`timeOff.repeatOptions.${value}`) }))
  const values = form.value()
  const pending = form.formState.isSubmitting
  const allDay = form.getControlProps("allDay")
  const repeat = form.getControlProps("repeat")
  const dateField = (field: "startDate" | "endDate" | "repeatUntil") => {
    const control = form.getControlProps(field)
    const label = t(`timeOff.${field}`)
    return <FormLabel error={form.error(field)} errorPlacement="below" label={field === "repeatUntil" ? <span className="inline-flex items-center gap-2">{label}<Badge size="sm" variant="secondary">{t("timeOff.optional")}</Badge></span> : label} description={field === "repeatUntil" ? t("timeOff.repeatUntilDescription") : undefined}>
      <DatePicker clearLabel={t("timeOff.clearDate")} disabled={pending} formatPreference={formatPreference} inputRef={control.ref} invalid={Boolean(form.error(field))} label={label} language={language} onBlur={control.onBlur} onChange={(value) => control.onChange(value ?? "")} placeholder={t(field === "repeatUntil" ? "timeOff.noEndDate" : "timeOff.chooseDate")} timeZone={timezone} value={control.value || null} />
    </FormLabel>
  }
  return <>
    <FormLabel error={form.error("title")} label={t("timeOff.title")}>
      <Input {...form.getInputProps("title")} aria-invalid={Boolean(form.error("title"))} disabled={pending} placeholder={t("timeOff.placeholder")} type="text" />
    </FormLabel>
    <div className="grid grid-cols-2 gap-4">{dateField("startDate")}{dateField("endDate")}</div>
    <FormSwitch checked={!allDay.value} disabled={pending} label={t("timeOff.specifyTimes")} onBlur={allDay.onBlur} onCheckedChange={(checked) => allDay.onChange(!checked)} ref={allDay.ref} />
    {!values.allDay ? <div className="grid grid-cols-2 gap-4">
      {(["startTime", "endTime"] as const).map((field) => {
        const control = form.getControlProps(field)
        const label = t(`timeOff.${field}`)
        return <FormLabel key={field} error={form.error(field)} errorPlacement="below" label={label}>
          <TimePicker disabled={pending} formatPreference={formatPreference} inputRef={control.ref} intervalMinutes={15} invalid={Boolean(form.error(field))} label={label} language={language} onBlur={control.onBlur} onChange={control.onChange} value={control.value} />
        </FormLabel>
      })}
    </div> : null}
    <FormLabel label={t("timeOff.repeat")} error={form.error("repeat")}>
      <Select disabled={pending} items={repeatItems} value={repeat.value} onValueChange={(value) => { if (value) repeat.onChange(value) }}>
        <SelectTrigger aria-invalid={Boolean(form.error("repeat")) || undefined} onBlur={repeat.onBlur} ref={repeat.ref}><SelectValue /></SelectTrigger>
        <SelectPopup>{repeatItems.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectPopup>
      </Select>
    </FormLabel>
    {values.repeat !== "none" ? dateField("repeatUntil") : null}
  </>
}
