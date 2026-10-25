import { useTranslation } from "react-i18next"
import { memo, useMemo } from "react"
import { TZDate } from "react-day-picker"

import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Separator } from "~/components/ui/separator"
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip"
import { UserAvatar } from "~/components/data-display/user-avatar"
import { defaultTimeZone, type FormatPreference } from "~/lib/localization/format-preference"
import { cn } from "~/lib/utils"

type BookingSlot = { startsAt: string; endsAt: string; staffMemberId: string; locationId: string | null }
type BookingMember = { id: string; name: string; image?: string | null }
type SlotItem = { key: string; member: BookingMember; label: string; time: string }

const dayPeriods = [
  { key: "night", from: 0, to: 6 },
  { key: "morning", from: 6, to: 12 },
  { key: "afternoon", from: 12, to: 17 },
  { key: "evening", from: 17, to: 24 },
] as const

export const bookingSlotKey = (slot: Pick<BookingSlot, "startsAt" | "staffMemberId" | "locationId">) => `${slot.startsAt}/${slot.staffMemberId}/${slot.locationId ?? ""}`

export function BookingSlotList({ days, members, selection, currentSlotKey, invalid, disabled = false, format, onSelect, showDateHeadings = true, timeZone = defaultTimeZone, formatPreference = "eu" }: {
  days: { date: string; slots: BookingSlot[] }[]
  members: BookingMember[]
  selection: string
  currentSlotKey?: string
  invalid: boolean
  disabled?: boolean
  showDateHeadings?: boolean
  timeZone?: string
  formatPreference?: FormatPreference
  format: (value: string, includeDate?: boolean, includeTime?: boolean, includeWeekday?: boolean) => string
  onSelect: (value: string) => void
}) {
  const { t } = useTranslation()
  const slotDays = useMemo(() => {
    const memberMap = new Map(members.map((member) => [member.id, member]))
    const memberFor = (id: string): BookingMember => memberMap.get(id) ?? { id, name: t("routeTitles.staffMember") }

    return days.filter((day) => day.slots.length > 0).map((day) => {
      const chronological = [...day.slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || memberFor(a.staffMemberId).name.localeCompare(memberFor(b.staffMemberId).name, "fi") || bookingSlotKey(a).localeCompare(bookingSlotKey(b)))
      const periods = dayPeriods.map((period) => ({ ...period, slots: [] as SlotItem[] }))
      for (const slot of chronological) {
        const hour = new TZDate(new Date(slot.startsAt), timeZone).getHours()
        const period = periods.find((item) => hour >= item.from && hour < item.to)
        if (!period) continue
        const member = memberFor(slot.staffMemberId)
        const startTime = format(slot.startsAt, false)
        const endTime = format(slot.endsAt, false)
        period.slots.push({
          key: bookingSlotKey(slot), member,
          label: `${member.name} · ${startTime} – ${endTime}`,
          time: `${startTime} – ${endTime}`,
        })
      }
      return { date: day.date, label: showDateHeadings ? format(day.slots[0].startsAt, true, false, true) : "", periods: periods.filter((period) => period.slots.length > 0) }
    })
  }, [days, members, format, timeZone, showDateHeadings, t])

  return <TooltipProvider><div className="flex w-full min-w-0 flex-col gap-5" data-slot="booking-slot-list">
    {slotDays.map((day) => <section className="flex min-w-0 flex-col gap-4" data-slot="booking-slot-day" key={day.date}>
      {showDateHeadings ? <h3 className="border-b pb-2 text-sm font-semibold"><time dateTime={day.date}>{day.label}</time></h3> : null}
      {day.periods.map((period) => <div className="flex min-w-0 flex-col gap-3" data-slot="booking-slot-period" key={period.key}>
        <h4 className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
          <Separator className="min-w-0 flex-1" />
          <span className="shrink-0">{t(`bookingForm.periods.${period.key}`)}</span>
          <Separator className="min-w-0 flex-1" />
        </h4>
        <div className={cn("grid w-full min-w-0 grid-cols-2 gap-3", formatPreference !== "us" && "md:grid-cols-3")} data-slot="booking-slots-by-time">
          {period.slots.map((slot) => <BookingSlotButton current={currentSlotKey === slot.key} disabled={disabled} invalid={invalid} key={slot.key} onSelect={onSelect} selected={selection === slot.key} slot={slot} />)}
        </div>
      </div>)}
    </section>)}
  </div></TooltipProvider>
}

const BookingSlotButton = memo(function BookingSlotButton({ slot, selected, current, invalid, disabled, onSelect }: {
  slot: SlotItem
  selected: boolean
  current: boolean
  invalid: boolean
  disabled: boolean
  onSelect: (value: string) => void
}) {
    const { t } = useTranslation()
    return <Tooltip disableHoverablePopup={true}>
      <TooltipTrigger render={<Button
      aria-invalid={invalid}
      aria-label={current ? `${slot.label} · ${t("bookingForm.currentTime")}` : slot.label}
      aria-pressed={selected}
      disabled={disabled}
      className="h-auto min-h-10 w-full min-w-0 touch-manipulation justify-start gap-2 px-1.5 py-2 text-xs whitespace-nowrap tabular-nums sm:text-xs"
      onClick={() => onSelect(slot.key)}
      type="button"
      variant={selected ? "default" : "outline"}
      />}>
      <UserAvatar className="size-4 shrink-0 text-[8px]" decorative={true} name={slot.member.name} src={slot.member.image} stableId={slot.member.id} />
      <span className="flex min-w-0 flex-1 flex-col gap-1 text-center">
        <span className="text-xs leading-4 whitespace-nowrap">
          {slot.time}
        </span>
      </span>
      {current ? <Badge className="pointer-events-none absolute top-0 left-1/2 h-3.5 min-w-0 -translate-x-1/2 -translate-y-1/2 bg-background px-1 text-[9px] leading-none sm:h-3.5 sm:min-w-0 sm:text-[9px] dark:bg-background" size="sm" variant="outline">{t("bookingForm.currentTime")}</Badge> : null}
      </TooltipTrigger>
      <TooltipPopup className="pointer-events-none whitespace-nowrap data-closed:hidden" positionMethod="fixed" side="top" sideOffset={6}>{slot.label}</TooltipPopup>
    </Tooltip>
})
