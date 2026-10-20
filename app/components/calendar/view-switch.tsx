import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import Icon, { type AppIconName } from "~/components/icons"
import { useCalendarState } from "~/components/calendar/use-calendar-state"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip"
import { cn } from "~/lib/utils"

const viewIcons = { day: "calendarEvent", week: "calendarWeek", list: "list" } satisfies Record<string, AppIconName>

export function CalendarViewSwitch({ mobile }: { mobile?: boolean }) {
  const { t } = useTranslation()
  const { mode, setSearchParams } = useCalendarState({ mobile })
  const labelRef = useRef<HTMLSpanElement>(null)
  const [showLabels, setShowLabels] = useState(true)

  useEffect(() => {
    const label = labelRef.current
    if (!label) return

    const updateLabels = () => setShowLabels(label.getClientRects().length > 0)
    updateLabels()
    const observer = new ResizeObserver(updateLabels)
    observer.observe(label)
    return () => observer.disconnect()
  }, [])

  return <ToggleGroup
    aria-label={t("calendarControls.view")}
    className="h-9 shrink-0 items-center rounded-lg bg-muted p-0.5"
    multiple={false}
    onValueChange={(values) => {
      const nextMode = values[0]
      if (nextMode !== "day" && nextMode !== "week" && nextMode !== "list") return
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous)
        next.set("view", nextMode)
        return next
      }, { replace: true, preventScrollReset: true })
    }}
    value={[mode]}
  >
    {(["day", "week", "list"] as const).map((viewMode) => <Tooltip disabled={showLabels} key={viewMode}>
      <TooltipTrigger render={<ToggleGroupItem
        aria-label={t(`calendarControls.${viewMode}`)}
        className={cn("h-full px-3 data-pressed:bg-background data-pressed:shadow-sm @max-3xl/calendar-controls:w-8 @max-3xl/calendar-controls:min-w-8 @max-3xl/calendar-controls:px-0", viewMode === "week" && "max-md:hidden")}
        type="button"
        value={viewMode}
      />}>
        <Icon aria-hidden={true} className="size-4 shrink-0" name={viewIcons[viewMode]} size={16} />
        <span className="@max-3xl/calendar-controls:hidden" ref={viewMode === "day" ? labelRef : undefined}>{t(`calendarControls.${viewMode}`)}</span>
      </TooltipTrigger>
      <TooltipPopup>{t(`calendarControls.${viewMode}`)}</TooltipPopup>
    </Tooltip>)}
  </ToggleGroup>
}
