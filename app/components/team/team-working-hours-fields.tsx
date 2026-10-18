import type { FormApi } from "@rvf/react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { SettingsSectionHeader } from "~/components/settings-section-header"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import type { PersonFormFields } from "~/lib/schemas/team"
import { TeamScheduleTimeFields } from "./team-schedule-time-fields"
import { TeamWorkingHoursWeek } from "./team-working-hours-week"

export function TeamWorkingHoursFields({ form, timezone, defaultHours, showHeader = true, resetPending = false, onResetToDefault }: { timezone: string; showHeader?: boolean; resetPending?: boolean; form: FormApi<PersonFormFields>; defaultHours: PersonFormFields["workingHours"]; onResetToDefault?: (hours: PersonFormFields["workingHours"]) => void | Promise<void> }) {
  const { t } = useTranslation("team")
  const hours = form.getControlProps("workingHours")
  const rules = hours.value ?? []
  const resetToDefault = async () => {
    const restoredHours = defaultHours.map(({ dayOfWeek, startMinute, endMinute, validFrom, validUntil, isActive }) => ({ dayOfWeek, startMinute, endMinute, timezone, validFrom, validUntil, isActive }))
    if (onResetToDefault) await onResetToDefault(restoredHours)
    else hours.onChange(restoredHours)
  }

  return (
    <div className="grid gap-4">
      {showHeader ? <SettingsSectionHeader title={t("people.availability")} description={t("people.editHoursDescription")} /> : null}
      <TeamWorkingHoursWeek
        disabled={form.formState.isSubmitting}
        rules={rules}
        onToggleDay={(day, enabled) => {
          const defaultRule = defaultHours.find((rule) => rule.dayOfWeek === day) ?? defaultHours[0]
          const existing = rules.some((rule) => rule.dayOfWeek === day)
          hours.onChange(existing
            ? rules.map((rule) => rule.dayOfWeek === day ? { ...rule, isActive: enabled } : rule)
            : [...rules, { dayOfWeek: day, startMinute: defaultRule?.startMinute ?? 480, endMinute: defaultRule?.endMinute ?? 1080, timezone, isActive: enabled, validFrom: null, validUntil: null }])
        }}
        onCopyDay={(day) => {
          const source = rules.filter((rule) => rule.dayOfWeek === day && rule.isActive)
          const copiedScopes = new Set<string>()
          hours.onChange(rules.flatMap((rule) => {
            if (rule.dayOfWeek === day || !rule.isActive) return [rule]
            const scope = JSON.stringify([rule.dayOfWeek, rule.timezone, rule.validFrom, rule.validUntil])
            if (copiedScopes.has(scope)) return []
            copiedScopes.add(scope)
            return source.map((period) => ({ ...rule, startMinute: period.startMinute, endMinute: period.endMinute }))
          }))
        }}
        renderTimes={(rule, index) => <TeamScheduleTimeFields form={form} field="workingHours" index={index} day={rule.dayOfWeek} />}
      />
      <TooltipProvider>
        <div className="flex justify-end">
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <Button aria-busy={resetPending} aria-label={t("people.resetHours")} disabled={form.formState.isSubmitting || resetPending} onClick={() => void resetToDefault()} size="sm" type="button" variant="outline"><span className="inline-flex size-4 shrink-0 items-center justify-center">{resetPending ? <Spinner aria-hidden={true} className="size-4" /> : <Icon aria-hidden={true} name="refresh" size={16} />}</span>{t("people.restoreToDefault")}</Button>
            </TooltipTrigger>
            <TooltipPopup>{t("people.resetHours")}</TooltipPopup>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  )
}
