import { useTranslation } from "react-i18next"
import { TZDate } from "react-day-picker"
import { Button } from "~/components/ui/button"
import { formatDateTime, type FormatPreference } from "~/lib/format-preference"
import type { BookingSlot } from "./booking-types"

export const publicSlotKey = (slot: BookingSlot) =>
  `${slot.startsAt}/${slot.staffMemberId}/${slot.locationId ?? ""}`

export function BookingTimeSlots({
  slots,
  selection,
  onSelect,
  timeZone,
  formatPreference,
}: {
  slots: BookingSlot[]
  selection: BookingSlot | null
  onSelect: (slot: BookingSlot) => void
  timeZone: string
  formatPreference: FormatPreference
}) {
  const { t, i18n } = useTranslation("booking")
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const byStart = new Map<string, BookingSlot>()
  for (const slot of [...slots].sort(
    (a, b) =>
      a.startsAt.localeCompare(b.startsAt) ||
      a.staffMemberId.localeCompare(b.staffMemberId),
  )) {
    const key = `${slot.startsAt}/${slot.locationId ?? ""}`
    if (!byStart.has(key)) byStart.set(key, slot)
  }
  const starts = [...byStart.values()]
  const periods = [
    { key: "night", from: 0, to: 6 },
    { key: "morning", from: 6, to: 12 },
    { key: "afternoon", from: 12, to: 17 },
    { key: "evening", from: 17, to: 24 },
  ] as const

  return (
    <div className="space-y-5">
      {periods.map((period) => {
        const times = starts.filter((slot) => {
          const hour = new TZDate(new Date(slot.startsAt), timeZone).getHours()
          return hour >= period.from && hour < period.to
        })
        if (!times.length) return null
        return (
          <section
            aria-label={t(period.key)}
            className="space-y-2.5"
            key={period.key}
          >
            <h2 className="text-xs font-medium text-muted-foreground">
              {t(period.key)}
            </h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {times.map((slot) => (
                <Button
                  aria-pressed={
                    selection !== null &&
                    publicSlotKey(selection) === publicSlotKey(slot)
                  }
                  className="h-11 tabular-nums sm:h-9"
                  key={publicSlotKey(slot)}
                  onClick={() => onSelect(slot)}
                  type="button"
                  variant={
                    selection !== null &&
                    publicSlotKey(selection) === publicSlotKey(slot)
                      ? "default"
                      : "secondary"
                  }
                >
                  {formatDateTime(slot.startsAt, {
                    formatPreference,
                    language,
                    timeZone,
                    includeDate: false,
                  })}
                </Button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
