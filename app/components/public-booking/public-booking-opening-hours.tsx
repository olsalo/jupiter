import { useTranslation } from "react-i18next"
import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "~/components/ui/popover"
import { formatDateTime, type FormatPreference } from "~/lib/localization/format-preference"
import type { BookingPageData } from "./booking-types"

export function PublicBookingOpeningHours({ hours, weekStartsOn, formatPreference }: {
  hours: BookingPageData["openingHours"]
  weekStartsOn: number
  formatPreference: FormatPreference
}) {
  const { t, i18n } = useTranslation("booking")
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const time = (minute: number) => formatDateTime(new Date(Date.UTC(2024, 0, 1, 0, minute)), { formatPreference, language, includeDate: false, timeZone: "UTC" })
  const groups: { firstDay: number, lastDay: number, label: string }[] = []

  for (let index = 0; index < 7; index++) {
    const day = (weekStartsOn + index) % 7
    const ranges: { startMinute: number, endMinute: number }[] = []
    for (const period of hours.filter((rule) => rule.dayOfWeek === day).sort((a, b) => a.startMinute - b.startMinute)) {
      const previous = ranges.at(-1)
      if (previous && period.startMinute <= previous.endMinute) previous.endMinute = Math.max(previous.endMinute, period.endMinute)
      else ranges.push({ startMinute: period.startMinute, endMinute: period.endMinute })
    }
    const label = ranges.length ? ranges.map((period) => `${time(period.startMinute)}–${time(period.endMinute)}`).join(", ") : t("closed")
    const previous = groups.at(-1)
    if (previous?.label === label) previous.lastDay = day
    else groups.push({ firstDay: day, lastDay: day, label })
  }
  const weekday = (day: number) => t(`calendarGrid.weekdays.${day}`, { ns: "common" })

  return <Popover>
    <PopoverTrigger render={<Button className="-ml-2 w-fit shrink-0 gap-1.5 text-muted-foreground sm:ml-0" size="sm" type="button" variant="ghost" />}>
      <Icon aria-hidden={true} name="clock" size={16} />
      {t("openingHours")}
      <Icon aria-hidden={true} name="chevronDown" size={14} />
    </PopoverTrigger>
    <PopoverPopup align="start" className="w-72" sideOffset={6}>
      <PopoverTitle className="mb-3 text-sm font-semibold">{t("openingHours")}</PopoverTitle>
      <dl className="grid gap-2 text-sm">
      {groups.map(({ firstDay, lastDay, label }) => <div className="flex items-baseline justify-between gap-6" key={firstDay}>
        <dt className="shrink-0 text-muted-foreground">{weekday(firstDay)}{firstDay !== lastDay ? `–${weekday(lastDay)}` : ""}</dt>
        <dd className="text-right tabular-nums">{label}</dd>
      </div>)}
      </dl>
    </PopoverPopup>
  </Popover>
}
