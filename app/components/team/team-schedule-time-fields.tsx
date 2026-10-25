import type { FormApi } from "@rvf/react"
import { useTranslation } from "react-i18next"
import { useRouteLoaderData } from "react-router"

import type { loader as rootLoader } from "~/root"
import FormLabel from "~/components/forms/form-label"
import { TimePicker } from "~/components/forms/time-picker"
import { isBreakTimeAvailable } from "~/lib/team/team-breaks"
import type { PersonFormFields } from "~/lib/schemas/team"
import { workingTimeValue } from "./team-working-hours-week"

export function TeamScheduleTimeFields({ form, field, index, day }: { form: FormApi<Pick<PersonFormFields, "workingHours" | "breaks">>; field: "workingHours" | "breaks"; index: number; day: number }) {
  const { t } = useTranslation("team")
  const root = useRouteLoaderData<typeof rootLoader>("root")

  return (
    <div className="flex items-start gap-5">
      {(["startMinute", "endMinute"] as const).map((timeField) => {
        const path = `${field}[${index}].${timeField}` as const
        const control = form.getControlProps(path)
        const error = form.error(path)
        const rule = form.value(`${field}[${index}]`)
        const label = t(timeField === "startMinute" ? "people.startsAt" : "people.endsAt")
        return <FormLabel className="relative w-25 gap-0" error={error} showError={false} label={label} labelClassName="sr-only" key={timeField}>
          {timeField === "endMinute" ? <span aria-hidden={true} className="absolute -left-3.5 top-1.5 text-muted-foreground">–</span> : null}
          <input name={control.name} type="hidden" value={control.value} />
          <TimePicker
            className="h-8 min-h-8 data-disabled:opacity-100"
            disabled={form.formState.isSubmitting}
            filterTime={(time) => {
              const [hour, minute] = time.split(":").map(Number)
              const clockMinute = hour * 60 + minute
              const selectedMinute = timeField === "endMinute" && clockMinute === 0 ? 1440 : clockMinute
              if (field === "breaks") return isBreakTimeAvailable(rule, timeField, selectedMinute, form.value("workingHours"), form.value("breaks").filter((_, position) => position !== index))
              return timeField === "startMinute"
                ? rule.endMinute < 0 || selectedMinute <= rule.endMinute - 15
                : rule.startMinute < 0 || selectedMinute >= rule.startMinute + 15
            }}
            formatPreference={root?.formatPreference ?? "eu"}
            inputRef={control.ref}
            intervalMinutes={15}
            invalid={Boolean(error)}
            label={`${t(`people.weekdays.${day}`)}: ${label}`}
            language={root?.locale === "fi" ? "fi" : "en"}
            onBlur={control.onBlur}
            onChange={(time) => {
              const [hour, minute] = time.split(":").map(Number)
              const value = hour * 60 + minute
              const selectedMinute = timeField === "endMinute" && value === 0 ? 1440 : value
              control.onChange(selectedMinute)
              if (field === "breaks") {
                const otherField = timeField === "startMinute" ? "endMinute" : "startMinute"
                const otherPath = `breaks[${index}].${otherField}` as const
                if (form.value(otherPath) < 0) {
                  form.setValue(otherPath, timeField === "startMinute"
                    ? Math.min(selectedMinute + 15, 1440)
                    : Math.max(selectedMinute - 15, 0))
                }
              }
            }}
            value={control.value >= 0 ? workingTimeValue(control.value) : null}
          />
        </FormLabel>
      })}
    </div>
  )
}
