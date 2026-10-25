import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import Icon from "~/components/icons"
import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import { Alert, AlertDescription } from "~/components/ui/alert"
import type { FormatPreference } from "~/lib/localization/format-preference"
import { BookingAppointmentCard } from "./booking-appointment-card"
import type { BookingPageData, BookingResult } from "./booking-types"

export function BookingConfirmation({
  booking,
  data,
  formatPreference,
  onRestart,
  rescheduled = false,
}: {
  booking: BookingResult
  data: Pick<BookingPageData, "organization" | "page">
  formatPreference: FormatPreference
  onRestart?: () => void
  rescheduled?: boolean
}) {
  const { t } = useTranslation("booking")
  const pending = booking.status === "PENDING"

  return (
    <main className="mx-auto my-auto w-full max-w-xl space-y-6 px-4 py-6 sm:space-y-7 sm:px-6 sm:py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-full",
            pending ? "bg-warning/10 text-warning" : "bg-success/10 text-success",
          )}
        >
          <Icon aria-hidden={true} className="size-6" name={pending ? "clock" : "check"} />
        </div>
        <div className="space-y-2" role="status">
          <h1 className="text-2xl font-medium tracking-tight">
            {t(rescheduled ? "rescheduleSuccess" : pending ? "pending" : "success")}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {rescheduled
              ? t("rescheduleSuccessHint", { business: data.organization.name })
              : pending ? t("pendingHint") : t("successHint", { business: data.organization.name })}
          </p>
        </div>
      </div>
      <BookingAppointmentCard booking={booking} formatPreference={formatPreference} />
      {data.page?.successMessage ? (
        <Alert className="border-0" variant="info">
          <AlertDescription className="whitespace-pre-wrap wrap-anywhere">
            {data.page.successMessage}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col items-stretch gap-2">
        <Button
          className="h-11 sm:h-10"
          render={<Link to={`/booking/${booking.bookingCode}`} />}
          type="button"
          variant="ghost"
        >
          {t("viewAppointment")}
        </Button>
        {onRestart ? <Button
          className="h-11 sm:h-10"
          onClick={onRestart}
          type="button"
          variant="ghost"
        >
          <Icon aria-hidden={true} name="plus" />
          {t("another")}
        </Button> : null}
      </div>
    </main>
  )
}
