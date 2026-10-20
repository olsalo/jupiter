import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import type { BookingAvailabilityIssue } from "~/lib/calendar/booking-issues"

export function CalendarBookingIssueMarker({ issues }: { issues?: BookingAvailabilityIssue[] }) {
  const { t } = useTranslation()
  if (!issues?.length) return null
  return <span aria-label={issues.map((issue) => t(`bookingIssues.${issue}`)).join(" · ")} className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-background/90 text-warning" data-slot="calendar-booking-issue-marker" role="img">
    <Icon aria-hidden={true} name="exclamationCircle" size={16} />
  </span>
}

export function CalendarBookingIssues({ issues }: { issues?: BookingAvailabilityIssue[] }) {
  const { t } = useTranslation()
  if (!issues?.length) return null
  return <Alert data-slot="calendar-booking-issues" variant="warning">
    <AlertTitle>{t("bookingIssues.title")}</AlertTitle>
    <AlertDescription><ul className="list-disc space-y-1 pl-4">{issues.map((issue) => <li key={issue}>{t(`bookingIssues.${issue}`)}</li>)}</ul></AlertDescription>
  </Alert>
}
