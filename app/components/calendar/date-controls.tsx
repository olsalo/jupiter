import { useState } from "react"
import { enUS, fi } from "react-day-picker/locale"
import { useTranslation } from "react-i18next"

import { useCalendarState } from "~/components/calendar/use-calendar-state"
import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Calendar } from "~/components/ui/calendar"
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "~/components/ui/popover"
import { calendarDateFromValue, calendarDateToValue } from "~/lib/calendar/date"
import { formatDateTime } from "~/lib/format-preference"

export function CalendarDateControls({ mobile }: { mobile?: boolean }) {
  const { t, i18n } = useTranslation()
  const { selected, mode, timeZone, weekStart, weekEnd, weekStartsOn, formatPreference, setSearchParams } = useCalendarState({ mobile })
  const [open, setOpen] = useState(false)
  const isWeek = mode !== "day"
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const formatDate = (date: Date, includeYear = true) => formatDateTime(date, { formatPreference, language, timeZone, includeTime: false, includeYear })
  const label = t(isWeek ? "calendarControls.chooseWeek" : "calendarControls.chooseDate")
  const selectDate = (date: Date) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set("date", calendarDateToValue(date))
      return next
    }, { replace: true, preventScrollReset: true })
    setOpen(false)
  }
  const moveDate = (direction: -1 | 1) => {
    const next = calendarDateFromValue(calendarDateToValue(selected), timeZone)
    next.setDate(next.getDate() + direction * (isWeek ? 7 : 1))
    selectDate(next)
  }

  return <div className="flex min-w-0 max-w-full flex-1 items-center gap-2 md:flex-initial" data-slot="calendar-date-controls">
    <Button aria-label={t(isWeek ? "calendarControls.previousWeek" : "calendarControls.previousDate")} className="shrink-0 max-sm:size-9" onClick={() => moveDate(-1)} size="icon-lg" type="button" variant="outline">
      <Icon aria-hidden={true} name="chevronLeft" size={16} />
    </Button>
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger aria-label={label} render={<Button className="w-60 min-w-0 max-w-full shrink justify-between max-sm:h-9 max-sm:flex-1" size="lg" type="button" variant="outline" />}>
        <span className="flex min-w-0 items-center gap-2">
          <Icon aria-hidden={true} name="calendar" size={16} />
          <span className="truncate">{isWeek ? `${formatDate(weekStart, weekStart.getFullYear() !== weekEnd.getFullYear())} – ${formatDate(weekEnd)}` : formatDate(selected)}</span>
        </span>
        <Icon aria-hidden={true} name="chevronDown" size={16} />
      </PopoverTrigger>
      <PopoverPopup align="start" sideOffset={6}>
        <PopoverTitle className="sr-only">{label}</PopoverTitle>
        {isWeek ? <Calendar
          classNames={{
            week: [
              "not-has-[[data-selected]]:[@media(hover:hover)]:hover:[&_button]:bg-accent not-has-[[data-selected]]:[@media(hover:hover)]:hover:[&_button]:text-accent-foreground not-has-[[data-selected]]:[@media(hover:hover)]:hover:[&_button]:rounded-none",
              "not-has-[[data-selected]]:[@media(hover:hover)]:hover:[&>td:first-child_button]:rounded-s-lg not-has-[[data-selected]]:[@media(hover:hover)]:hover:[&>td:last-child_button]:rounded-e-lg",
              "not-has-[[data-selected]]:has-[button:active,button:focus-visible]:[&_button]:bg-accent not-has-[[data-selected]]:has-[button:active,button:focus-visible]:[&_button]:text-accent-foreground not-has-[[data-selected]]:has-[button:active,button:focus-visible]:[&_button]:rounded-none",
              "not-has-[[data-selected]]:has-[button:active,button:focus-visible]:[&>td:first-child_button]:rounded-s-lg not-has-[[data-selected]]:has-[button:active,button:focus-visible]:[&>td:last-child_button]:rounded-e-lg",
            ].join(" "),
          }}
          defaultMonth={selected}
          locale={language === "fi" ? fi : enUS}
          mode="range"
          onDayClick={selectDate}
          selected={{ from: weekStart, to: weekEnd }}
          timeZone={timeZone}
          weekStartsOn={weekStartsOn}
        /> : <Calendar
          autoFocus={true}
          defaultMonth={selected}
          locale={language === "fi" ? fi : enUS}
          mode="single"
          onSelect={selectDate}
          required={true}
          selected={selected}
          timeZone={timeZone}
          weekStartsOn={weekStartsOn}
        />}
      </PopoverPopup>
    </Popover>
    <Button aria-label={t(isWeek ? "calendarControls.nextWeek" : "calendarControls.nextDate")} className="shrink-0 max-sm:size-9" onClick={() => moveDate(1)} size="icon-lg" type="button" variant="outline">
      <Icon aria-hidden={true} name="chevronRight" size={16} />
    </Button>
  </div>
}
