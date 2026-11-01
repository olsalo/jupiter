import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Alert, AlertDescription } from "~/components/ui/alert"
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
  return <Alert data-slot="calendar-booking-issues" showIcon={false} variant="warning">
    <AlertDescription>{issues.length === 1 ? t(`bookingIssues.${issues[0]}`) : <ul className="flex list-disc flex-col gap-1 pl-4">{issues.map((issue) => <li key={issue}>{t(`bookingIssues.${issue}`)}</li>)}</ul>}</AlertDescription>
  </Alert>
}
