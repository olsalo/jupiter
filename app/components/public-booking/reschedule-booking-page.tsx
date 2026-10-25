import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { Link, useNavigate, useNavigation } from "react-router"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { bookingPageColorStyle } from "~/lib/booking/booking-page-colors"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Spinner } from "~/components/ui/spinner"
import { formatDateTime } from "~/lib/localization/format-preference"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import { useFormatPreference } from "~/lib/hooks/use-format-preference"
import { PublicBookingHeader } from "./public-booking-header"
import { BookingTimePicker } from "./booking-time-picker"
import type { BookingSlot } from "./booking-types"

export function RescheduleBookingPage({ bookingCode }: { bookingCode: string }) {
  const { t, i18n } = useTranslation("booking")
  const trpc = useTRPC()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const queryClient = useQueryClient()
  const preference = useFormatPreference()
  const page = useQuery(trpc.booking.getReschedulePage.queryOptions({ bookingCode }, { retry: false, retryOnMount: false }))
  const mutation = useMutation(trpc.booking.reschedule.mutationOptions())
  const [slot, setSlot] = useState<BookingSlot | null>(null)
  const [ready, setReady] = useState(false)
  const [conflict, setConflict] = useState(false)
  const conflictRef = useRef<HTMLDivElement>(null)
  const scroll = useRef<HTMLDivElement>(null)
  const data = page.data
  const booking = data?.booking
  const options = {
    formatPreference: preference.value,
    language: i18n.resolvedLanguage === "fi" ? "fi" as const : "en" as const,
    timeZone: booking?.timezone,
  }
  const canReschedule = Boolean(data?.canReschedule && +new Date(data.deadline) > Date.now())

  async function confirm() {
    if (!slot || !ready || !canReschedule || mutation.isPending) return
    try {
      const saved = await mutation.mutateAsync({ bookingCode, startsAt: new Date(slot.startsAt) })
      queryClient.setQueryData(trpc.booking.getByCode.queryKey({ bookingCode }), saved)
      queryClient.setQueryData(trpc.booking.getManagementPage.queryKey({ bookingCode }), (current) => current ? { ...current, booking: saved } : current)
      await Promise.all([
        queryClient.invalidateQueries(trpc.booking.getManagementPage.queryFilter({ bookingCode })),
        queryClient.invalidateQueries(trpc.booking.getReschedulePage.queryFilter({ bookingCode })),
        queryClient.invalidateQueries(trpc.booking.getRescheduleSlots.pathFilter()),
      ])
      toast.success(t("rescheduleSuccess"))
      await navigate(`/booking/${encodeURIComponent(bookingCode)}`, { replace: true })
    } catch (error) {
      const code = error && typeof error === "object" && "data" in error
        ? (error.data as { code?: string; appCode?: string } | undefined)
        : undefined
      if (code?.appCode === "SLOT_UNAVAILABLE" || code?.code === "CONFLICT") {
        setConflict(true)
        setSlot(null)
        setReady(false)
        await queryClient.invalidateQueries(trpc.booking.getRescheduleSlots.pathFilter())
        requestAnimationFrame(() => {
          conflictRef.current?.scrollIntoView({ block: "nearest" })
          conflictRef.current?.focus()
        })
      } else {
        toast.error(t("rescheduleError"), t("errorHint"))
      }
      void page.refetch()
    }
  }

  return (
    <div className="flex h-dvh pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom,0px)] text-foreground" style={bookingPageColorStyle(data?.accentColor)}>
      <title>{data ? `${t("rescheduleTitle")} · ${data.organization.name}` : t("rescheduleTitle")}</title>
      <PublicBookingHeader
        formatPreference={preference.value}
        onFormatPreferenceChange={preference.set}
        organization={data?.organization}
      />
      <ScrollArea
        className="h-auto min-h-0 flex-1 [&_[data-slot=scroll-area-content]]:flex [&_[data-slot=scroll-area-content]]:min-h-full [&_[data-slot=scroll-area-content]]:flex-col"
        scrollbarClassName="max-lg:hidden"
        scrollFade={true}
        viewportProps={{ ref: scroll }}
      >
        {!data || !booking ? (
          <main className="mx-auto my-auto w-full max-w-xl px-4 py-8 sm:px-6">
            {page.isPending ? (
              <div className="flex justify-center"><Spinner aria-label={t("loading")} className="size-6" /></div>
            ) : (
              <Alert className="border-0" variant="error">
                <AlertTitle>{t("rescheduleUnavailable")}</AlertTitle>
                <AlertDescription>
                  {t("unavailableHint")}
                  <Button className="self-start" onClick={() => void page.refetch()} type="button" variant="ghost">
                    {t("retry")}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </main>
        ) : (
          <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:w-[calc(100%_-_3rem)] lg:px-8">
            <div className="flex flex-col gap-2">
              <Button
                className="-ml-2 self-start"
                render={<Link to={`/booking/${bookingCode}`} />}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Icon aria-hidden={true} name="arrowLeft" />
                {t("bookingDetailsTitle")}
              </Button>
              <h1 className="text-lg font-medium sm:text-xl">{t("rescheduleTitle")}</h1>
              <p className="text-sm leading-6 text-muted-foreground">{t("rescheduleHint")}</p>
            </div>
            {page.isError ? <Alert className="border-0" variant="warning">
              <AlertTitle>{t("refreshError")}</AlertTitle>
              <AlertDescription>{t("refreshHint")}</AlertDescription>
            </Alert> : null}
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8">
              <aside aria-label={t("currentAppointment")} className="flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/30 p-4 lg:col-start-2 lg:row-start-1 lg:p-5">
                <h2 className="text-xs text-muted-foreground">{t("currentAppointment")}</h2>
                <p className="text-sm leading-6 font-medium wrap-anywhere">{booking.services.map((service) => service.name).join(", ")}</p>
                <div className="flex flex-col gap-1 text-sm tabular-nums">
                  <p>{formatDateTime(booking.startsAt, { ...options, includeTime: false, includeWeekday: true })}</p>
                  <p>{formatDateTime(booking.startsAt, { ...options, includeDate: false })} – {formatDateTime(booking.endsAt, { ...options, includeDate: false })}</p>
                </div>
                <p className="text-xs leading-5 wrap-anywhere text-muted-foreground">
                  {[booking.staffMember?.name, booking.location?.name].filter(Boolean).join(" · ")}
                </p>
                {canReschedule ? <p className="text-xs leading-5 text-muted-foreground">
                  {t("rescheduleBefore", { date: formatDateTime(data.deadline, options) })}
                </p> : null}
              </aside>
              <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-1">
                {canReschedule ? <>
                  {conflict ? <div ref={conflictRef} tabIndex={-1} className="outline-none">
                    <Alert className="border-0" variant="warning">
                      <AlertTitle>{t("conflict")}</AlertTitle>
                      <AlertDescription>{t("rescheduleConflictHint")}</AlertDescription>
                    </Alert>
                  </div> : null}
                  <div inert={mutation.isPending} aria-busy={mutation.isPending}>
                    <BookingTimePicker
                      formatPreference={preference.value}
                      getQueryOptions={(range) => trpc.booking.getRescheduleSlots.queryOptions({ bookingCode, ...range })}
                      maxDays={data.maxBookingAdvanceDays}
                      onReadyChange={setReady}
                      onSelect={(value) => {
                        setSlot(value)
                        setConflict(false)
                      }}
                      slot={slot}
                      timeZone={booking.timezone}
                    />
                  </div>
                </> : (
                  <Alert className="border-0" variant="info">
                    <AlertTitle>{t("rescheduleUnavailable")}</AlertTitle>
                    <AlertDescription>{t("contactToReschedule")}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </main>
        )}
      </ScrollArea>
      {data && booking && canReschedule ? (
        <footer className="shrink-0 border-t border-border/50 bg-background pb-3 lg:py-4">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pt-3 sm:px-6 lg:w-[calc(100%_-_3rem)] lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-8 lg:pt-0">
            <div className="flex min-w-0 flex-1 flex-col gap-1" aria-live="polite" aria-atomic={true}>
              <p className="min-w-0 text-sm leading-5 font-medium wrap-anywhere">{t("newTime")}</p>
              <p className="text-xs leading-5 tabular-nums text-muted-foreground">
                {slot ? formatDateTime(slot.startsAt, options) : t("chooseNewTime")}
              </p>
            </div>
            <Button
              className="h-12 w-full gap-2.5 px-6 text-base sm:ml-auto sm:h-12 sm:w-auto sm:min-w-44 sm:text-base"
              disabled={!ready || !slot || mutation.isPending || navigation.state !== "idle"}
              loading={mutation.isPending || navigation.state !== "idle"}
              onClick={() => void confirm()}
              type="button"
            >
              {t("confirmReschedule")}
              <Icon aria-hidden={true} name="arrowRight" />
            </Button>
          </div>
        </footer>
      ) : null}
    </div>
  )
}
