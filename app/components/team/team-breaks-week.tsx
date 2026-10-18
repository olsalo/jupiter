import { useId, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Switch } from "~/components/ui/switch"
import { cn } from "~/lib/utils"
import { workingWeekdays } from "./team-working-hours-week"

export function TeamBreaksWeek<Rule extends { dayOfWeek: number; isActive: boolean }>({ rules, workingDays, renderTimes, disabled = false, onToggleDay, onAdd, onRemove }: {
  rules: Rule[]
  workingDays: number[]
  renderTimes: (rule: Rule, index: number) => ReactNode
  disabled?: boolean
  onToggleDay?: (day: number, enabled: boolean) => void
  onAdd?: (day: number) => void
  onRemove?: (index: number) => void
}) {
  const { t } = useTranslation("team")
  const id = useId()
  return (
    <div className="divide-y" data-slot="breaks-week">
      {workingWeekdays.map((day) => {
        const working = workingDays.includes(day)
        const periods = rules.map((rule, index) => ({ rule, index })).filter(({ rule }) => rule.dayOfWeek === day && rule.isActive)
        const enabled = working && periods.length > 0
        const dayLabel = t(`people.weekdays.${day}`)
        return (
          <div className="flex min-h-14 items-start justify-between gap-3 py-3 max-[420px]:flex-wrap" key={day}>
            {onToggleDay ? <label className={cn("flex h-8 shrink-0 items-center gap-2 text-sm", !working && "text-muted-foreground")} htmlFor={`${id}-${day}`}>
              <Switch checked={enabled} className="[--thumb-size:--spacing(3.5)] sm:[--thumb-size:--spacing(3.5)]" disabled={disabled || !working || (!enabled && rules.length >= 100)} id={`${id}-${day}`} onCheckedChange={(checked) => onToggleDay(day, checked)} />
              {dayLabel}
            </label> : <span className="flex h-8 shrink-0 items-center text-sm">{dayLabel}</span>}
            {enabled ? <div className="grid gap-2 max-[420px]:ml-auto">
              {periods.map(({ rule, index }, periodIndex) => <div className="flex items-start gap-2" key={index}>
                {renderTimes(rule, index)}
                {onAdd && onRemove ? <Button aria-label={t(periodIndex === 0 ? "people.addBreak" : "people.removeBreak", { day: dayLabel })} className="size-8 sm:size-8" disabled={disabled || (periodIndex === 0 && rules.length >= 100)} onClick={() => periodIndex === 0 ? onAdd(day) : onRemove(index)} size="icon" type="button" variant="ghost"><Icon aria-hidden={true} name={periodIndex === 0 ? "add" : "trash"} size={16} /></Button> : null}
              </div>)}
            </div> : <span className="my-1 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{t(working ? "people.noBreaks" : "people.dayOff")}</span>}
          </div>
        )
      })}
    </div>
  )
}
