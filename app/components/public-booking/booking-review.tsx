import { useTranslation } from "react-i18next"
import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { formatDateTime, type FormatPreference } from "~/lib/format-preference"
import { BookingSummary } from "./booking-summary"
import type {
  BookingDetails,
  BookingPageData,
  BookingService,
  BookingScreen,
  BookingSlot,
} from "./booking-types"

export function BookingReview({
  data,
  service,
  slot,
  details,
  formatPreference,
  onEdit,
  onChange,
}: {
  data: BookingPageData
  service: BookingService
  slot: BookingSlot
  details: BookingDetails
  formatPreference: FormatPreference
  onEdit: () => void
  onChange: (screen: BookingScreen) => void
}) {
  const { t, i18n } = useTranslation("booking")
  const options = {
    formatPreference,
    language:
      i18n.resolvedLanguage === "fi" ? ("fi" as const) : ("en" as const),
    timeZone: data.settings.timezone,
  }
  const cancellationDeadline = new Date(
    +new Date(slot.startsAt) -
      (service.cancellationNoticeMinutes ??
        data.settings.cancellationNoticeMinutes) *
        60000,
  )
  const rescheduleDeadline = new Date(
    +new Date(slot.startsAt) -
      (service.rescheduleNoticeMinutes ??
        data.settings.rescheduleNoticeMinutes) *
        60000,
  )
  const questions = data.questions.filter(
    (question) => !question.serviceId || question.serviceId === service.id,
  )
  const answerLabel = (value: unknown) =>
    typeof value === "boolean"
      ? t(value ? "yes" : "no")
      : Array.isArray(value)
        ? value.join(", ")
        : String(value ?? "")

  const answers =
    details.answers?.flatMap((answer) => {
      const question = questions.find((item) => item.id === answer.questionId)
      const label = answerLabel(answer.value)
      return question && label.trim()
        ? [{ ...answer, label: question.label, value: label }]
        : []
    }) ?? []
  const requiresConfirmation =
    service.requiresConfirmation || !data.settings.autoConfirmAppointments

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="rounded-xl border border-border/50 p-4 sm:p-5 lg:hidden">
        <BookingSummary data={data} formatPreference={formatPreference} onChange={onChange} service={service} slot={slot} />
      </section>
      {requiresConfirmation ? (
        <Alert className="border-0" variant="info">
          <AlertTitle>{t("confirmationRequired")}</AlertTitle>
          <AlertDescription>{t("reviewRequestHint")}</AlertDescription>
        </Alert>
      ) : null}
      <section className="space-y-5 rounded-xl border border-border/50 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium">
            <Icon
              aria-hidden={true}
              className="size-4 text-muted-foreground"
              name="user"
            />
            {t("details")}
          </h2>
          <Button
            aria-label={`${t("edit")} ${t("details").toLocaleLowerCase()}`}
            className="-my-1 -mr-2 hidden lg:inline-flex"
            onClick={onEdit}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("edit")}
          </Button>
        </div>
        <div className="space-y-6">
          <dl className="space-y-4 text-sm">
            <div className="grid min-w-0 gap-1.5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-xs text-muted-foreground">
                {t("customerName")}
              </dt>
              <dd className="font-medium wrap-anywhere">
                {[details.customer.firstName, details.customer.lastName]
                  .filter(Boolean)
                  .join(" ")}
              </dd>
            </div>
            {details.customer.email ? (
              <div className="grid min-w-0 gap-1.5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
                <dt className="text-xs text-muted-foreground">{t("email")}</dt>
                <dd className="wrap-anywhere">{details.customer.email}</dd>
              </div>
            ) : null}
            {details.customer.phone ? (
              <div className="grid min-w-0 gap-1.5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
                <dt className="text-xs text-muted-foreground">{t("phone")}</dt>
                <dd className="tabular-nums wrap-anywhere">
                  {details.customer.phone}
                </dd>
              </div>
            ) : null}
          </dl>
          {answers.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-sm font-medium">{t("questions")}</h2>
              <dl className="space-y-4 text-sm">
                {answers.map((answer) => (
                  <div key={answer.questionId}>
                    <dt className="text-xs leading-5 wrap-anywhere text-muted-foreground">
                      {answer.label}
                    </dt>
                    <dd className="mt-1.5 whitespace-pre-wrap wrap-anywhere">
                      {answer.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
          {details.notes ? (
            <section className="space-y-2">
              <h2 className="text-sm font-medium">{t("reviewNotes")}</h2>
              <p className="text-sm leading-6 whitespace-pre-wrap wrap-anywhere">
                {details.notes}
              </p>
            </section>
          ) : null}
        </div>
      </section>
      <Alert className="border-border/50 bg-muted/30" showIcon={false} variant="default">
        <AlertDescription className="grid w-full gap-5 text-xs leading-5 sm:grid-cols-2 sm:gap-6">
          <section className="space-y-1">
            <h2 className="font-medium text-foreground">{t("cancellation")}</h2>
            <p>
              {data.settings.allowCustomerCancellation &&
              +cancellationDeadline > Date.now()
                ? t("cancelBefore", {
                    date: formatDateTime(cancellationDeadline, options),
                  })
                : t("contactToCancel")}
            </p>
          </section>
          <section className="space-y-1">
            <h2 className="font-medium text-foreground">{t("rescheduling")}</h2>
            <p>
              {data.settings.allowCustomerRescheduling &&
              +rescheduleDeadline > Date.now()
                ? t("rescheduleBefore", {
                    date: formatDateTime(rescheduleDeadline, options),
                  })
                : t("contactToReschedule")}
            </p>
          </section>
        </AlertDescription>
      </Alert>
    </div>
  )
}
