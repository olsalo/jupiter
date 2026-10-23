import { useEffect, useRef, useState } from "react"
import { keepPreviousData, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query"
import type { TRPCQueryKey } from "@trpc/tanstack-react-query"
import { useTranslation } from "react-i18next"
import { TZDate } from "react-day-picker"

import Icon from "~/components/icons"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import { calendarDateFromValue, calendarDateToValue } from "~/lib/calendar/date"
import { formatCalendarDay, formatDateTime, type FormatPreference } from "~/lib/format-preference"
import { toast } from "~/lib/toast"
import { cn } from "~/lib/utils"
import { BookingTimeSlots, publicSlotKey } from "./booking-time-slots"
import { PublicBookingLoading } from "./public-booking-state"
import type { BookingSlot } from "./booking-types"

type SlotData = { days: { date: string; slots: BookingSlot[] }[] }
type SlotQueryOptions = Pick<UseQueryOptions<SlotData, Error, SlotData, TRPCQueryKey>, "queryKey" | "queryFn">

export function BookingTimePicker({
  timeZone: zone,
  maxDays,
  slot,
  onSelect,
  onReadyChange,
  onSearchingChange,
  formatPreference,
  getQueryOptions,
  resetKey = "",
}: {
  timeZone: string
  maxDays: number
  slot: BookingSlot | null
  onSelect: (slot: BookingSlot | null) => void
  onReadyChange: (ready: boolean) => void
  onSearchingChange?: (searching: boolean) => void
  formatPreference: FormatPreference
  getQueryOptions: (range: { from: Date; to: Date }) => SlotQueryOptions
  resetKey?: string
}) {
  const { t, i18n } = useTranslation("booking")
  const language = i18n.resolvedLanguage === "fi" ? "fi" : "en"
  const queryClient = useQueryClient()
  const [today] = useState(() =>
    calendarDateToValue(new TZDate(new Date(), zone)),
  )
  const [start, setStart] = useState(() =>
    slot
      ? calendarDateToValue(new TZDate(new Date(slot.startsAt), zone))
      : today,
  )
  const [selectedDate, setSelectedDate] = useState(start)
  const [searching, setSearching] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  useEffect(() => {
    onSearchingChange?.(searching)
  }, [searching, onSearchingChange])
  const searchSequence = useRef(0)
  useEffect(
    () => () => {
      searchSequence.current += 1
    },
    [],
  )
  const from = calendarDateFromValue(start, zone)
  const to = calendarDateFromValue(start, zone)
  to.setDate(to.getDate() + 7)
  const query = useQuery({
    ...getQueryOptions({ from: new Date(from), to: new Date(to) }),
    placeholderData: keepPreviousData,
    retry: false,
  })
  const backgroundRefreshing =
    query.isFetching &&
    !query.isPending &&
    !query.isPlaceholderData &&
    !searching
  const days = query.data?.days ?? []
  const selectedDay = days.find((day) => day.date === selectedDate) ?? days[0]
  const lastDay = calendarDateFromValue(today, zone)
  lastDay.setDate(lastDay.getDate() + maxDays)
  const atEnd = +to > +lastDay
  const ready = Boolean(
    slot &&
    !query.isPending &&
    !query.isPlaceholderData &&
    !searching &&
    days.some((day) =>
      day.slots.some((item) => publicSlotKey(item) === publicSlotKey(slot)),
    ),
  )
  useEffect(() => {
    onReadyChange(ready)
  }, [ready, onReadyChange])
  const format = (
    value: string | Date,
    includeDate = true,
    includeTime = true,
    includeWeekday = false,
  ) =>
    formatDateTime(value, {
      formatPreference,
      language,
      timeZone: zone,
      includeDate,
      includeTime,
      includeWeekday,
      includeYear: false,
    })
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = calendarDateFromValue(start, zone)
    day.setDate(day.getDate() + index)
    return { value: calendarDateToValue(day), date: day }
  })

  function moveWeek(direction: number) {
    const next = calendarDateFromValue(start, zone)
    next.setDate(next.getDate() + direction * 7)
    const value = calendarDateToValue(next)
    setStart(value < today ? today : value)
    setSelectedDate("")
    setExhausted(false)
    onSelect(null)
  }

  async function findNextAvailable() {
    const sequence = ++searchSequence.current
    setSearching(true)
    try {
      let cursor = calendarDateFromValue(start, zone)
      cursor.setDate(cursor.getDate() + 7)
      while (+cursor <= +lastDay) {
        const end = new TZDate(cursor, zone)
        end.setDate(end.getDate() + 28)
        const result = await queryClient.fetchQuery(
          { ...getQueryOptions({ from: new Date(cursor), to: new Date(end) }), staleTime: 0, retry: false },
        )
        if (sequence !== searchSequence.current) return
        const first = result.days.find((day) => day.slots.length > 0)
        if (first) {
          setStart(first.date)
          setSelectedDate(first.date)
          onSelect(null)
          return
        }
        cursor = end
      }
      setExhausted(true)
    } catch {
      toast.error(t("slotsError"))
    } finally {
      if (sequence === searchSequence.current) setSearching(false)
    }
  }

  const previousResetKey = useRef(resetKey)
  useEffect(() => {
    if (previousResetKey.current === resetKey) return
    previousResetKey.current = resetKey
    searchSequence.current += 1
    setSearching(false)
    setExhausted(false)
    setSelectedDate("")
  }, [resetKey])

  return (
    <div className="space-y-4 sm:space-y-5">
      <section aria-label={t("date")} className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Button
            aria-label={t("previousWeek")}
            className="size-11 sm:size-10"
            disabled={start <= today || searching}
            onClick={() => moveWeek(-1)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Icon aria-hidden={true} name="chevronLeft" />
          </Button>
          <div className="relative flex min-h-8 items-center justify-center px-6">
            <p className="text-sm font-medium tabular-nums">
              {format(from, true, false)} –{" "}
              {format(new Date(+to - 1), true, false)}
            </p>
            <span
              aria-hidden={!backgroundRefreshing}
              className="absolute right-0 flex size-4 items-center justify-center"
            >
              <Spinner
                aria-label={t("loading")}
                className={cn("size-3.5", !backgroundRefreshing && "invisible")}
              />
            </span>
          </div>
          <Button
            aria-label={t("nextWeek")}
            className="size-11 sm:size-10"
            disabled={atEnd || searching}
            onClick={() => moveWeek(1)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <Icon aria-hidden={true} name="chevronRight" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => {
            const available = days.some(
              (item) => item.date === day.value && item.slots.length > 0,
            )
            const label = formatCalendarDay(day.date, language, zone)
            return (
              <Button
                aria-label={format(day.date, true, false, true)}
                aria-pressed={selectedDay?.date === day.value}
                className={cn(
                  "h-16 min-w-0 flex-col gap-1 px-0 sm:h-16",
                  !available && "text-muted-foreground",
                )}
                disabled={
                  !available ||
                  query.isPending ||
                  query.isPlaceholderData ||
                  searching
                }
                key={day.value}
                onClick={() => {
                  if (selectedDay?.date === day.value) return
                  setSelectedDate(day.value)
                  onSelect(null)
                }}
                type="button"
                variant={selectedDay?.date === day.value ? "default" : "ghost"}
              >
                <span className="text-[11px] font-normal opacity-75">
                  {label.weekday}
                </span>
                <span className="text-base font-medium tabular-nums">
                  {label.day}
                </span>
                <span
                  aria-hidden={true}
                  className={cn(
                    "size-1 rounded-full",
                    available ? "bg-current" : "bg-transparent",
                  )}
                />
              </Button>
            )
          })}
        </div>
      </section>
      <div
        aria-busy={query.isPending || query.isPlaceholderData || searching}
        className="relative min-h-72"
        data-slot="public-booking-times"
      >
        {query.isPending || query.isPlaceholderData || searching ? (
          <PublicBookingLoading className="absolute inset-0 z-10 min-h-72" label={t("loading")} />
        ) : null}
        <div
          className={cn(
            (query.isPending || query.isPlaceholderData || searching) &&
              "pointer-events-none opacity-30",
          )}
          aria-hidden={query.isPlaceholderData || searching}
          inert={query.isPlaceholderData || searching}
        >
          {query.isError && !query.data ? (
            <Alert className="border-0" variant="error">
              <AlertTitle>{t("slotsError")}</AlertTitle>
              <AlertDescription>
                <Button
                  className="mt-2 self-start"
                  onClick={() => void query.refetch()}
                  type="button"
                  variant="ghost"
                >
                  {t("retry")}
                </Button>
              </AlertDescription>
            </Alert>
          ) : !selectedDay && !query.isPending ? (
            <Alert className="border-0" variant="info">
              <AlertTitle>
                {t(exhausted ? "noFutureTimes" : "noTimes")}
              </AlertTitle>
              <AlertDescription>
                {t(exhausted ? "noFutureTimesHint" : "noTimesHint")}
                {!exhausted && !atEnd ? (
                  <Button
                    className="mt-2 self-start"
                    onClick={() => void findNextAvailable()}
                    type="button"
                    variant="ghost"
                  >
                    {t("nextAvailable")}
                    <Icon aria-hidden={true} name="arrowRight" />
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : selectedDay ? (
            <BookingTimeSlots
              slots={selectedDay.slots}
              selection={slot}
              onSelect={onSelect}
              timeZone={zone}
              formatPreference={formatPreference}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
