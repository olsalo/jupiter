import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip"
import { useCalendarState } from "~/components/calendar/use-calendar-state"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"

export function CalendarDayLayoutSwitch({ mobile = false }: { mobile?: boolean }) {
  const { t } = useTranslation()
  const { mode, dayLayout, setSearchParams } = useCalendarState({ mobile })
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
  }, [mobile, mode])

  if (mobile || mode !== "day") return null

  return <ToggleGroup aria-label={t("calendarControls.dayLayout")} className="h-9 shrink-0 rounded-lg bg-muted p-0.5 max-md:hidden" multiple={false} value={[dayLayout]} onValueChange={(values) => {
    const layout = values[0]
    if (layout !== "columns" && layout !== "rows") return
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      if (layout === "rows") next.set("layout", layout)
      else next.delete("layout")
      return next
    }, { replace: true, preventScrollReset: true })
  }}>
    {(["columns", "rows"] as const).map((layout) => <Tooltip disabled={showLabels} key={layout}>
      <TooltipTrigger render={<ToggleGroupItem
        aria-label={t(`calendarControls.${layout}`)}
        className="h-full px-3 text-xs data-pressed:bg-background data-pressed:shadow-sm @max-3xl/calendar-controls:w-8 @max-3xl/calendar-controls:min-w-8 @max-3xl/calendar-controls:px-0"
        type="button"
        value={layout}
      />}>
        <Icon aria-hidden={true} className="size-4 shrink-0" name={layout === "columns" ? "layoutColumns" : "layoutRows"} size={16} />
        <span className="@max-3xl/calendar-controls:hidden" ref={layout === "columns" ? labelRef : undefined}>{t(`calendarControls.${layout}`)}</span>
      </TooltipTrigger>
      <TooltipPopup>{t(`calendarControls.${layout}`)}</TooltipPopup>
    </Tooltip>)}
  </ToggleGroup>
}
