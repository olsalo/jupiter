import { useTranslation } from "react-i18next"
import Icon from "~/components/icons"
import { UserAvatar } from "~/components/data-display/user-avatar"
import { Badge } from "~/components/ui/badge"
import { Card, CardHeader, CardPanel, CardTitle } from "~/components/ui/card"
import { formatDateTime, formatNumber, type FormatPreference } from "~/lib/localization/format-preference"
import type { BookingResult } from "./booking-types"

export function BookingAppointmentCard({ booking, formatPreference, showPrice = false }: {
  booking: BookingResult
  formatPreference: FormatPreference
  showPrice?: boolean
}) {
  const { t, i18n } = useTranslation("booking")
  const options = {
    formatPreference,
    language: i18n.resolvedLanguage === "fi" ? "fi" as const : "en" as const,
    timeZone: booking.timezone,
  }
  const duration = booking.services.reduce((total, service) => total + service.durationMinutes, 0)
  const address = [booking.location?.addressLine1, booking.location?.city].filter(Boolean).join(", ")

  return (
    <Card className="rounded-xl border-border/50 shadow-none before:hidden">
      <CardHeader className="gap-2 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{t("summary")}</p>
          <Badge size="sm" variant="secondary">
            {t("duration", { minutes: duration })}
            {showPrice ? ` · ${formatNumber(Number(booking.totalAmount), formatPreference, { style: "currency", currency: booking.currency })}` : ""}
          </Badge>
        </div>
        <CardTitle className="text-base leading-6 font-medium wrap-anywhere" render={<h2 />}>
          {booking.services.map((service) => service.name).join(", ")}
        </CardTitle>
      </CardHeader>
      <CardPanel className="space-y-5 px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="flex items-start gap-3">
          <Icon aria-hidden={true} className="mt-0.5 size-4 shrink-0 text-muted-foreground" name="calendar" />
          <div className="min-w-0 space-y-1 text-sm">
            <p className="text-xs text-muted-foreground">{t("date")}</p>
            <p className="font-medium wrap-anywhere">
              {formatDateTime(booking.startsAt, {
                ...options,
                includeTime: false,
                includeWeekday: true,
              })}
            </p>
            <p className="tabular-nums">
              {formatDateTime(booking.startsAt, { ...options, includeDate: false })} – {formatDateTime(booking.endsAt, { ...options, includeDate: false })}
            </p>
          </div>
        </div>
        {booking.staffMember ? (
          <div className="flex items-center gap-3 text-sm">
            <UserAvatar
              className="size-5 shrink-0 text-[9px]"
              decorative={true}
              name={booking.staffMember.name}
              stableId={booking.staffMember.name}
            />
            <div className="min-w-0 space-y-1">
              <p className="text-xs text-muted-foreground">{t("staff")}</p>
              <p className="wrap-anywhere">{booking.staffMember.name}</p>
            </div>
          </div>
        ) : null}
        {booking.location ? (
          <div className="flex items-start gap-3 text-sm">
            <Icon aria-hidden={true} className="mt-0.5 size-4 shrink-0 text-muted-foreground" name="buildingStore" />
            <div className="min-w-0 space-y-1">
              <p className="text-xs text-muted-foreground">{t("location")}</p>
              <p className="font-medium wrap-anywhere">{booking.location.name}</p>
              {address ? <p className="text-muted-foreground wrap-anywhere">{address}</p> : null}
              {booking.location.bookingInstructions ? (
                <p className="pt-1 text-xs leading-5 whitespace-pre-wrap wrap-anywhere text-muted-foreground">
                  {booking.location.bookingInstructions}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardPanel>
    </Card>
  )
}
