import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { TZDate } from "react-day-picker"
import { useRouteLoaderData, useSearchParams } from "react-router"

import { useCalendarBookingPreview } from "~/components/calendar/calendar-booking-preview"
import { calendarDateToValue, getCalendarDateState } from "~/lib/calendar/date"
import { calendarReferenceQueryOptions } from "~/lib/calendar/query-options"
import { defaultTimeZone } from "~/lib/format-preference"
import { useMediaQuery } from "~/lib/hooks"
import { sortCalendarMembers } from "~/lib/calendar/schedule"
import { useTRPC } from "~/lib/trpc/client"
import type { loader as rootLoader } from "~/root"
import type { clientLoader as calendarClientLoader } from "~/routes/calendar/calendar"

export function useCalendarState({ preview: showPreview = true, mobile }: { preview?: boolean, mobile?: boolean } = {}) {
  const { preview } = useCalendarBookingPreview()
  const matchesMobile = useMediaQuery("max-768px")
  const isMobile = mobile ?? matchesMobile
  const trpc = useTRPC()
  const organization = useQuery({ ...trpc.organizations.getCurrent.queryOptions(), ...calendarReferenceQueryOptions })
  const staff = useQuery({ ...trpc.staff.list.queryOptions(), ...calendarReferenceQueryOptions })
  const calendar = useRouteLoaderData<typeof calendarClientLoader>("routes/calendar/calendar")
  const now = calendar?.now ?? Date.now()
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const [searchParams, setSearchParams] = useSearchParams()
  const memberId = organization.data?.memberId
  const bookableMembers = useMemo(() => sortCalendarMembers(staff.data?.filter((member) => member.isActive && member.acceptsAppointments) ?? []), [staff.data])
  const requestedMemberId = searchParams.get("member")
  const requestedMember = requestedMemberId
    ? bookableMembers.find((member) => member.id === requestedMemberId)
    : searchParams.get("scope") === "personal" && memberId ? bookableMembers.find((member) => member.memberId === memberId) : undefined
  const selectedMember = requestedMember ?? (isMobile
    ? bookableMembers.find((member) => member.memberId === memberId) ?? bookableMembers[0]
    : undefined)
  const settings = organization.data?.settings
  const timeZone = settings?.timezone ?? root?.organizationTimezone ?? defaultTimeZone
  const calendarParams = new URLSearchParams(searchParams)
  if (showPreview && preview && (!selectedMember || preview.member.id === selectedMember.id)) calendarParams.set("date", calendarDateToValue(new TZDate(preview.startsAt, timeZone)))
  const calendarParamsKey = calendarParams.toString()
  const weekStartsOn = settings?.weekStartsOn ?? 1
  const defaultCalendarView = settings?.defaultCalendarView ?? "week"
  const dateState = useMemo(() => getCalendarDateState(new URLSearchParams(calendarParamsKey), {
    now, timeZone, weekStartsOn, defaultCalendarView,
  }), [calendarParamsKey, now, timeZone, weekStartsOn, defaultCalendarView])

  const mode = isMobile && dateState.mode === "week" ? "day" : dateState.mode

  return {
    ...dateState, mode, now, isMobile, dayLayout: !isMobile && searchParams.get("layout") === "rows" ? "rows" as const : "columns" as const, organization, staff, bookableMembers, selectedMember, timeZone, searchParams, setSearchParams,
    formatPreference: root?.formatPreference ?? "eu",
    startMinute: (settings?.defaultStartHour ?? 8) * 60,
    endMinute: (settings?.defaultEndHour ?? 18) * 60,
  }
}
