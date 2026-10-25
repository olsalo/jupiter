import { calendarMinDurationMinutes } from "~/lib/calendar/time-step"
import { useQuery } from "@tanstack/react-query"

import { useCalendarBookingPreview } from "~/components/calendar/calendar-booking-preview"
import { useCalendarState } from "~/components/calendar/use-calendar-state"
import { getCalendarBookingDurationLimit } from "~/lib/calendar/booking-duration"
import { calendarPanelQueryOptions } from "~/lib/calendar/query-options"
import { useTRPC } from "~/lib/trpc/client"

export function useCalendarBookingDurationLimit({ startsAt, memberId, appointmentId, length, beforeMinutes, afterMinutes }: {
  startsAt?: Date
  memberId?: string | null
  appointmentId?: string
  length: number | null
  beforeMinutes?: number
  afterMinutes?: number
}) {
  const trpc = useTRPC()
  const { dragging } = useCalendarBookingPreview()
  const { organization } = useCalendarState({ preview: false })
  const simultaneous = organization.data?.settings?.allowSimultaneousBookings === true
  const from = startsAt ?? new Date(0)
  const bookings = useQuery({
    ...trpc.appointment.list.queryOptions({ from: new Date(+from - (240 + (beforeMinutes ?? 0)) * 60000), to: new Date(+from + (1440 + 240 + (afterMinutes ?? 0)) * 60000), staffMemberId: memberId ?? undefined }),
    ...calendarPanelQueryOptions,
    enabled: !dragging && Boolean(startsAt && memberId && organization.data && !simultaneous),
  })
  // Existing overlaps can remain, but they must not permit further extension
  const current = Math.max(calendarMinDurationMinutes, length ?? calendarMinDurationMinutes)
  if (simultaneous || !startsAt || !memberId) return 1440
  if (!bookings.data || bookings.isError) return current
  return Math.max(current, getCalendarBookingDurationLimit(bookings.data, startsAt, memberId, appointmentId, { beforeMinutes, afterMinutes }))
}
