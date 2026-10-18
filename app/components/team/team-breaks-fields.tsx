import { useRef } from "react"
import type { FormApi } from "@rvf/react"
import { useTranslation } from "react-i18next"

import { SettingsSectionHeader } from "~/components/settings-section-header"
import { toggleBreakDay } from "~/lib/team-breaks"
import type { PersonFormFields } from "~/lib/schemas/team"
import { TeamBreaksWeek } from "./team-breaks-week"
import { TeamScheduleTimeFields } from "./team-schedule-time-fields"

export function TeamBreaksFields({ form, timezone, showHeader = true }: { showHeader?: boolean; form: FormApi<PersonFormFields>; timezone: string }) {
  const { t } = useTranslation("team")
  const breaks = form.getControlProps("breaks")
  const pausedBreaks = useRef(new Map<number, PersonFormFields["breaks"]>())
  const hours = form.getControlProps("workingHours")
  const addBreak = (dayOfWeek: number) => breaks.onChange([...breaks.value, { dayOfWeek, startMinute: -1, endMinute: -1, timezone, isActive: true, validFrom: null, validUntil: null }])
  return (
    <div className="grid gap-4">
      {showHeader ? <SettingsSectionHeader title={t("people.breaks")} description={t("people.breaksDescription")} /> : null}
      <TeamBreaksWeek
        rules={breaks.value}
        workingDays={hours.value.filter((rule) => rule.isActive).map((rule) => rule.dayOfWeek)}
        disabled={form.formState.isSubmitting}
        onToggleDay={(day, enabled) => breaks.onChange(toggleBreakDay(breaks.value, day, enabled, timezone, pausedBreaks.current))}
        onAdd={addBreak}
        onRemove={(index) => breaks.onChange(breaks.value.filter((_, position) => position !== index))}
        renderTimes={(rule, index) => <TeamScheduleTimeFields form={form} field="breaks" index={index} day={rule.dayOfWeek} />}
      />
    </div>
  )
}
