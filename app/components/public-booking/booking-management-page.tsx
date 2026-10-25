import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router"

import { DeleteConfirmationDialog } from "~/components/delete-confirmation-dialog"
import Icon from "~/components/icons"
import { bookingPageColorStyle } from "~/lib/booking-page-colors"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"
import { formatDateTime } from "~/lib/format-preference"
import { toast } from "~/lib/toast"
import { useTRPC } from "~/lib/trpc/client"
import { useFormatPreference } from "~/lib/use-format-preference"
import { BookingAppointmentCard } from "./booking-appointment-card"
import { PublicBookingHeader } from "./public-booking-header"
import { PublicBookingLoading, PublicBookingUnavailable } from "./public-booking-state"

export function BookingManagementPage({ bookingCode }: { bookingCode: string }) {
  const { t, i18n } = useTranslation("booking")
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const preference = useFormatPreference()
  const page = useQuery(trpc.booking.getManagementPage.queryOptions({ bookingCode }, { retry: false, retryOnMount: false }))
  const cancel = useMutation(trpc.booking.cancel.mutationOptions())
  const [cancelOpen, setCancelOpen] = useState(false)
  const location = useLocation()
  const confirmationMessage = typeof location.state?.confirmationMessage === "string" ? location.state.confirmationMessage : null
  const data = page.data
  const booking = data?.booking
  const options = {
    formatPreference: preference.value,
    language: i18n.resolvedLanguage === "fi" ? "fi" as const : "en" as const,
    timeZone: booking?.timezone,
  }
  const upcoming = Boolean(booking && +new Date(booking.startsAt) > Date.now() && !data?.expired && ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(booking.status))
  const canReschedule = Boolean(upcoming && data?.canReschedule && +new Date(data.deadline) > Date.now())
  const canCancel = Boolean(upcoming && data?.canCancel && +new Date(data.cancellationDeadline) > Date.now())
  const status = data?.expired ? "EXPIRED" : booking?.status
  const statusVariant = status === "COMPLETED"
    ? "success" as const
    : status === "PENDING" ? "warning" as const : "secondary" as const

  async function cancelBooking() {
    if (!canCancel || cancel.isPending) return
    try {
      const saved = await cancel.mutateAsync({ bookingCode })
      queryClient.setQueryData(trpc.booking.getByCode.queryKey({ bookingCode }), saved)
      queryClient.setQueryData(trpc.booking.getManagementPage.queryKey({ bookingCode }), (current) => current ? {
        ...current,
        booking: saved,
        expired: false,
        canCancel: false,
        canReschedule: false,
      } : current)
      setCancelOpen(false)
      await Promise.all([
        queryClient.invalidateQueries(trpc.booking.getManagementPage.queryFilter({ bookingCode })),
        queryClient.invalidateQueries(trpc.booking.getReschedulePage.queryFilter({ bookingCode })),
        queryClient.invalidateQueries(trpc.booking.getRescheduleSlots.pathFilter()),
      ])
    } catch {
      setCancelOpen(false)
      toast.error(t("cancelError"), t("errorHint"))
      void page.refetch()
    }
  }

  return (
    <div className="flex h-dvh pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] flex-col overflow-hidden bg-background pb-[env(safe-area-inset-bottom,0px)] text-foreground" style={bookingPageColorStyle(data?.accentColor)}>
      <title>{data ? `${t("bookingDetailsTitle")} · ${data.organization.name}` : t("bookingDetailsTitle")}</title>
      <PublicBookingHeader
        formatPreference={preference.value}
        onFormatPreferenceChange={preference.set}
        organization={data?.organization}
      />
      <ScrollArea
        className="h-auto min-h-0 flex-1 [&_[data-slot=scroll-area-content]]:flex [&_[data-slot=scroll-area-content]]:min-h-full [&_[data-slot=scroll-area-content]]:flex-col"
        scrollbarClassName="max-lg:hidden"
        scrollFade={true}
      >
        <main className="mx-auto my-auto flex w-full max-w-xl flex-col gap-6 px-4 py-6 sm:gap-7 sm:px-6 sm:py-8">
          {!data || !booking ? page.isPending ? (
            <PublicBookingLoading label={t("bookingLoading")} />
          ) : (
            <PublicBookingUnavailable
              notFound={page.error?.data?.code === "NOT_FOUND"}
              onRetry={() => void page.refetch()}
              retrying={page.isFetching}
              title={t("bookingUnavailable")}
            />
          ) : <>
            <div className="flex flex-col items-center gap-3 text-center">
              {status !== "CONFIRMED" ? <Badge variant={statusVariant}>{t(`bookingStatus.${status}`)}</Badge> : null}
              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-medium tracking-tight">{t("bookingDetailsTitle")}</h1>
                <p className="text-sm leading-6 text-muted-foreground" role="status">
                  {t(data.expired ? "bookingExpiredHint" : booking.status === "CANCELLED" ? "bookingCancelledHint" : booking.status === "PENDING" ? "pendingHint" : "bookingDetailsHint")}
                </p>
              </div>
            </div>
            {page.isError ? <Alert className="border-0" variant="warning">
              <AlertTitle>{t("refreshError")}</AlertTitle>
              <AlertDescription>{t("refreshHint")}</AlertDescription>
            </Alert> : null}
            {confirmationMessage ? <Alert className="border-0" variant="info">
              <AlertDescription className="whitespace-pre-wrap wrap-anywhere">{confirmationMessage}</AlertDescription>
            </Alert> : null}
            <BookingAppointmentCard booking={booking} formatPreference={preference.value} showPrice={true} />
            {upcoming ? (
              <div className="flex flex-col gap-4 text-sm">
                <div className="flex flex-col gap-1">
                  <h2 className="font-medium">{t("rescheduling")}</h2>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {canReschedule ? t("rescheduleBefore", { date: formatDateTime(data.deadline, options) }) : t("contactToReschedule")}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <h2 className="font-medium">{t("cancellation")}</h2>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {canCancel ? t("cancelBefore", { date: formatDateTime(data.cancellationDeadline, options) }) : t("contactToCancel")}
                  </p>
                </div>
                {(!canReschedule || !canCancel) && (data.contact?.email || data.contact?.phone) ? (
                  <Alert className="border-0" variant="info">
                    <AlertTitle>{t("contactBusiness")}</AlertTitle>
                    <AlertDescription>
                      {data.contact.phone ? <a className="w-fit underline underline-offset-4" href={`tel:${data.contact.phone}`}>{data.contact.phone}</a> : null}
                      {data.contact.email ? <a className="w-fit wrap-anywhere underline underline-offset-4" href={`mailto:${data.contact.email}`}>{data.contact.email}</a> : null}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              {canReschedule ? <Button
                className="h-12 gap-2.5 text-base sm:h-12 sm:text-base"
                render={<Link to={`/booking/${bookingCode}/reschedule`} />}
                type="button"
              >
                {t("rescheduleTitle")}
                <Icon aria-hidden={true} name="arrowRight" />
              </Button> : null}
              {canCancel ? <Button
                className="h-11 text-destructive-foreground hover:text-destructive-foreground sm:h-10"
                disabled={cancel.isPending}
                onClick={() => setCancelOpen(true)}
                type="button"
                variant="ghost"
              >
                {t("cancelAppointment")}
              </Button> : null}
              {!upcoming ? <Button
                className="h-12 text-base sm:h-12 sm:text-base"
                render={<Link to={`/book/${data.organization.slug}`} />}
                type="button"
                variant="outline"
              >
                {t("another")}
              </Button> : null}
            </div>
            <DeleteConfirmationDialog
              cancelLabel={t("keepAppointment")}
              closeOnConfirm={false}
              confirmLabel={t("confirmCancellation")}
              description={t("cancelConfirmationHint", { date: formatDateTime(booking.startsAt, options) })}
              isPending={cancel.isPending}
              onConfirm={() => void cancelBooking()}
              onOpenChange={setCancelOpen}
              open={cancelOpen && canCancel}
              title={t("cancelConfirmationTitle")}
            />
          </>}
        </main>
      </ScrollArea>
    </div>
  )
}
