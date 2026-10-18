import { useTranslation } from "react-i18next"

import { useCalendarState } from "~/components/calendar/use-calendar-state"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"

export function CalendarViewSwitch() {
  const { t } = useTranslation()
  const { mode, setSearchParams } = useCalendarState()

  return <ToggleGroup
    aria-label={t("calendarControls.view")}
    className="h-9 shrink-0 items-center rounded-lg bg-muted p-0.5 max-sm:min-w-0 max-sm:flex-1"
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
    {(["day", "week", "list"] as const).map((viewMode) => <ToggleGroupItem className="h-full flex-1 px-3 data-pressed:bg-background data-pressed:shadow-sm" key={viewMode} type="button" value={viewMode}>{t(`calendarControls.${viewMode}`)}</ToggleGroupItem>)}
  </ToggleGroup>
}
