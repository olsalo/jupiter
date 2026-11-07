import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Toast } from "@base-ui/react/toast"
import { ToastProvider } from "~/components/ui/toast"
import Icon from "~/components/icons"
import { formatDateTime, type FormatPreference } from "~/lib/localization/format-preference"
import { useTRPC } from "~/lib/trpc/client"
import type { BookingScope } from "./booking-types"

const recentBookingToastManager = Toast.createToastManager()

export function RecentBookingToasts({ scope, formatPreference, timeZone }: {
  scope: BookingScope
  formatPreference: FormatPreference
  timeZone: string
}) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation("booking")
  const presentation = useRef({ t, language: i18n.resolvedLanguage, formatPreference, timeZone })
  presentation.current = { t, language: i18n.resolvedLanguage, formatPreference, timeZone }

  useEffect(() => {
    const shown = new Set<string>()
    const historyKey = `booking-toast-history:${JSON.stringify([scope.organizationSlug, scope.bookingPageSlug ?? null])}`
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(historyKey) ?? "[]")
      if (Array.isArray(stored)) {
        for (const id of stored) {
          if (typeof id === "string") shown.add(id)
        }
      }
    } catch {
      // Activity notifications also work when browser storage is unavailable
    }
    let stopped = false
    let fetching = false
    let visibilityRevision = 0
    let nextDelay = 50_000
    let toastId: string | undefined
    let timer: ReturnType<typeof setTimeout>

    async function showNext() {
      if (fetching || document.visibilityState !== "visible") return
      fetching = true
      const requestRevision = visibilityRevision
      try {
        const bookings = await queryClient.query(trpc.booking.getRecentBookings.queryOptions({
          organizationSlug: scope.organizationSlug,
          bookingPageSlug: scope.bookingPageSlug,
        }, { staleTime: 0, retry: false }))
        if (stopped || requestRevision !== visibilityRevision || document.visibilityState !== "visible") return
        const candidates = bookings.filter((item) => !shown.has(item.id))
        const booking = candidates[Math.floor(Math.random() * candidates.length)]
        if (!booking) return
        shown.add(booking.id)
        try {
          localStorage.setItem(historyKey, JSON.stringify([...shown]))
        } catch {
          // Keep showing activity even if browser storage is full or disabled
        }
        const current = presentation.current
        const appointmentTime = formatDateTime(booking.startsAt, {
          formatPreference: current.formatPreference,
          language: current.language === "fi" ? "fi" : "en",
          timeZone: current.timeZone,
          includeYear: false,
        })
        toastId = recentBookingToastManager.add({
          title: (
            <span className="flex items-center gap-3 py-1">
              <span aria-hidden={true} className="relative flex size-10 shrink-0 items-center justify-center rounded-md bg-success/10 text-success ring-1 ring-success/15 ring-inset">
                <Icon className="size-5" name="calendarEvent" />
                <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-success text-white ring-2 ring-popover">
                  <Icon className="size-2.5" name="check" />
                </span>
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs leading-4 font-normal text-muted-foreground">
                  {current.t("recentBookingLabel")}{" "}
                  <span className="whitespace-nowrap">
                    <span aria-hidden={true}>· </span>
                    <time
                      aria-label={current.t("recentBookingTime", { time: appointmentTime })}
                      className="tabular-nums"
                      dateTime={new Date(booking.startsAt).toISOString()}
                    >
                      {appointmentTime}
                    </time>
                  </span>
                </span>
                <span className="text-sm leading-5 font-semibold wrap-anywhere">{booking.serviceName}</span>
              </span>
            </span>
          ),
          timeout: 6000,
          priority: "low",
        })
      } catch {
        // Optional activity notifications must not interrupt booking
      } finally {
        fetching = false
      }
    }

    function tick() {
      if (stopped) return
      timer = setTimeout(tick, nextDelay)
      nextDelay = 60_000
      void showNext()
    }

    function resetSchedule() {
      clearTimeout(timer)
      visibilityRevision += 1
      if (document.visibilityState === "visible") {
        nextDelay = 50_000
        timer = setTimeout(tick, 10_000)
      }
    }

    document.addEventListener("visibilitychange", resetSchedule)
    resetSchedule()
    return () => {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", resetSchedule)
      if (toastId) recentBookingToastManager.close(toastId)
    }
  }, [queryClient, trpc, scope.organizationSlug, scope.bookingPageSlug])

  return <ToastProvider position="bottom-left" toastManager={recentBookingToastManager} />
}
