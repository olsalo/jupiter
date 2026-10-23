import { useTranslation } from "react-i18next"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"

export function BookingCustomerDetails({ message, answers }: {
  message: string | null
  answers: { id: string; value: unknown; question: { label: string; sortOrder: number } }[]
}) {
  const { t } = useTranslation()
  const { t: tBooking } = useTranslation("booking")
  if (!message && !answers.length) return null

  const answerText = (value: unknown) => typeof value === "boolean"
    ? tBooking(value ? "yes" : "no")
    : Array.isArray(value) ? value.join(", ") : String(value ?? "")

  return <Alert variant="info">
    <AlertTitle>{t("bookingForm.customerDetails")}</AlertTitle>
    <AlertDescription className="min-w-0 gap-3">
      {message ? <p className="whitespace-pre-wrap wrap-anywhere">{message}</p> : null}
      {answers.length ? <dl className="grid gap-3">
        {[...answers].sort((a, b) => a.question.sortOrder - b.question.sortOrder).map((answer) => <div className="min-w-0" key={answer.id}>
          <dt className="font-medium wrap-anywhere">{answer.question.label}</dt>
          <dd className="whitespace-pre-wrap wrap-anywhere">{answerText(answer.value)}</dd>
        </div>)}
      </dl> : null}
    </AlertDescription>
  </Alert>
}
