import { useId, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { Switch } from "~/components/ui/switch"

export const workingWeekdays = [1, 2, 3, 4, 5, 6, 0]

export function workingTimeValue(minute: number) {
  return `${String(Math.floor((minute % 1440) / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
}

export function TeamWorkingHoursWeek<Rule extends { dayOfWeek: number; isActive: boolean }>({
  rules, renderTimes, onToggleDay, onCopyDay, disabled = false,
}: {
  disabled?: boolean
  rules: Rule[]
  renderTimes: (rule: Rule, index: number) => ReactNode
  onToggleDay?: (day: number, enabled: boolean) => void
  onCopyDay?: (day: number) => void
}) {
  const { t } = useTranslation("team")
  const id = useId()

  return (
    <TooltipProvider>
      <div className="divide-y" data-slot="working-hours-week">
        {workingWeekdays.map((day) => {
          const dayRules = rules.map((rule, index) => ({ rule, index })).filter(({ rule }) => rule.dayOfWeek === day && rule.isActive)
          const enabled = dayRules.length > 0
          return (
            <div className="flex min-h-14 items-start justify-between gap-3 py-3 max-[420px]:flex-wrap" key={day}>
              {onToggleDay ? <label className="flex h-8 shrink-0 items-center gap-2 text-sm" htmlFor={`${id}-${day}`}>
                <Switch
                  checked={enabled}
                  className="[--thumb-size:--spacing(3.5)] sm:[--thumb-size:--spacing(3.5)] data-disabled:opacity-100"
                  disabled={disabled || !onToggleDay}
                  id={`${id}-${day}`}
                  onCheckedChange={(checked) => onToggleDay?.(day, checked)}
                />
                {t(`people.weekdays.${day}`)}
              </label> : <span className="flex h-8 shrink-0 items-center text-sm">{t(`people.weekdays.${day}`)}</span>}
              <div className="flex min-w-0 items-start gap-2 max-[420px]:ml-auto">
                {enabled ? <div className="grid gap-2">{dayRules.map(({ rule, index }) => <div key={index}>{renderTimes(rule, index)}</div>)}</div> : <span className="my-1 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{t("people.dayOff")}</span>}
                {onCopyDay && enabled ? (
                  <Tooltip>
                    <TooltipTrigger render={<span className="inline-flex shrink-0" />}>
                      <Button
                        aria-label={t("people.copyHours", { day: t(`people.weekdays.${day}`) })}
                        className="size-8 sm:size-8"
                        disabled={disabled || workingWeekdays.filter((weekday) => rules.some((rule) => rule.dayOfWeek === weekday && rule.isActive)).length < 2}
                        onClick={() => onCopyDay(day)}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Icon aria-hidden={true} name="copy" size={14} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipPopup>{t("people.copyHoursTooltip")}</TooltipPopup>
                  </Tooltip>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
