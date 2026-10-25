import type { FormApi } from "@rvf/react"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import { DatePicker } from "~/components/forms/date-picker"
import FormLabel from "~/components/forms/form-label"
import { FormSwitch } from "~/components/forms/form-switch"
import { TimePicker } from "~/components/forms/time-picker"
import { Input } from "~/components/ui/input"
import type { BusinessHolidayValues } from "~/lib/schemas/business-schedule"
import type { loader as rootLoader } from "~/root"

export function BusinessHolidayFormFields({ form, timezone, custom, repeatsYearly = true, nameLabel }: { form: FormApi<BusinessHolidayValues>; timezone: string; custom: boolean; repeatsYearly?: boolean; nameLabel?: string }) {
  const { t } = useTranslation()
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const language = root?.locale === "fi" ? "fi" : "en"
  const formatPreference = root?.formatPreference ?? "eu"
  const pending = form.formState.isSubmitting
  const date = form.getControlProps("date")
  const closed = form.getControlProps("closed")
  return <div className="grid gap-4">
    {custom ? <>
      <FormLabel error={form.error("name")} label={nameLabel ?? t("businessSchedule.name")}>
        <Input {...form.getInputProps("name")} aria-invalid={Boolean(form.error("name"))} disabled={pending} type="text" />
      </FormLabel>
      <FormLabel description={repeatsYearly ? t("businessSchedule.repeatsYearly") : undefined} error={form.error("date")} label={t("businessSchedule.date")}>
        <DatePicker clearLabel={t("businessSchedule.clearDate")} disabled={pending} formatPreference={formatPreference} inputRef={date.ref} invalid={Boolean(form.error("date"))} label={t("businessSchedule.date")} language={language} onBlur={date.onBlur} onChange={(value) => date.onChange(value ?? "")} placeholder={t("businessSchedule.chooseDate")} timeZone={timezone} value={date.value || null} />
      </FormLabel>
    </> : null}
    <FormSwitch checked={closed.value} disabled={pending} label={t("businessSchedule.closedAllDay")} onBlur={closed.onBlur} onCheckedChange={closed.onChange} ref={closed.ref} />
    {!closed.value ? <div className="grid grid-cols-2 gap-4">{(["startMinute", "endMinute"] as const).map((field) => {
      const control = form.getControlProps(field)
      const label = t(field === "startMinute" ? "businessSchedule.opensAt" : "businessSchedule.closesAt")
      const minute = control.value
      const time = `${String(Math.floor(minute / 60) % 24).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
      return <FormLabel error={form.error(field)} key={field} label={label}>
        <TimePicker disabled={pending} formatPreference={formatPreference} inputRef={control.ref} intervalMinutes={15} invalid={Boolean(form.error(field))} label={label} language={language} onBlur={control.onBlur} onChange={(value) => {
          const [hour, minutes] = value.split(":").map(Number)
          control.onChange(field === "endMinute" && hour === 0 && minutes === 0 ? 1440 : hour * 60 + minutes)
        }} value={time} />
      </FormLabel>
    })}</div> : null}
  </div>
}
