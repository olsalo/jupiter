import type { FormApi } from "@rvf/react"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import { DatePicker } from "~/components/forms/date-picker"
import FormLabel from "~/components/forms/form-label"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { TimePicker } from "~/components/forms/time-picker"
import { Input } from "~/components/ui/input"
import type { BusinessHolidayValues } from "~/lib/schemas/business-schedule"
import type { loader as rootLoader } from "~/root"

export function BusinessHolidayFormFields({ form, timezone, custom, repeatsYearly = true, nameLabel }: { form: FormApi<BusinessHolidayValues>; timezone: string; custom: boolean; repeatsYearly?: boolean; nameLabel?: string }) {
  const { i18n, t } = useTranslation()
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const formatPreference = root?.formatPreference ?? "eu"
  const pending = form.formState.isSubmitting
  const closed = form.getControlProps("closed")
  return <div className="grid gap-4">
    {custom ? <>
      <FormLabel error={form.error("name")} label={nameLabel ?? t("businessSchedule.name")}>
        <Input {...form.getInputProps("name")} aria-invalid={Boolean(form.error("name"))} disabled={pending} type="text" />
      </FormLabel>
      <div className="grid grid-cols-2 gap-4">{(["date", "endDate"] as const).map((field) => {
        const control = form.getControlProps(field)
        const label = t(field === "date" ? "businessSchedule.startDate" : "businessSchedule.endDate")
        return <FormLabel error={form.error(field)} key={field} label={label}>
          <DatePicker clearLabel={t("businessSchedule.clearDate")} defaultMonth={form.value("date") ? new Date(`${form.value("date")}T12:00:00Z`) : undefined} disabled={pending} formatPreference={formatPreference} inputRef={control.ref} invalid={Boolean(form.error(field))} label={label} language={language} onBlur={control.onBlur} onChange={(value) => control.onChange(value ?? "")} placeholder={t(field === "endDate" ? "businessSchedule.sameDay" : "businessSchedule.chooseDate")} timeZone={timezone} value={control.value || null} />
        </FormLabel>
      })}</div>
      {repeatsYearly ? <p className="text-xs text-muted-foreground">{t("businessSchedule.repeatsYearly")}</p> : null}
    </> : null}
    <FormLabel error={form.error("closed")} label={t("businessSchedule.dayStatus")}>
      <ToggleGroup
        aria-label={t("businessSchedule.dayStatus")}
        className="grid w-full grid-cols-2 rounded-lg bg-muted p-1"
        disabled={pending}
        multiple={false}
        onBlur={closed.onBlur}
        onValueChange={(values) => {
          const value = values[0]
          if (value === "closed" || value === "open") closed.onChange(value === "closed")
        }}
        ref={closed.ref}
        value={[closed.value ? "closed" : "open"]}
      >
        <ToggleGroupItem className="h-8 w-full data-pressed:bg-background data-pressed:shadow-xs" type="button" value="closed">{t("businessSchedule.closed")}</ToggleGroupItem>
        <ToggleGroupItem className="h-8 w-full data-pressed:bg-background data-pressed:shadow-xs" type="button" value="open">{t("businessSchedule.open")}</ToggleGroupItem>
      </ToggleGroup>
    </FormLabel>
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
