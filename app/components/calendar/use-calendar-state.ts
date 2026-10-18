import { useQuery } from "@tanstack/react-query"
import { TZDate } from "react-day-picker"
import { useRouteLoaderData, useSearchParams } from "react-router"

import { useCalendarBookingPreview } from "~/components/calendar/calendar-booking-preview"
import { calendarDateToValue, getCalendarDateState } from "~/lib/calendar-date"
import { calendarReferenceQueryOptions } from "~/lib/calendar-query"
import { defaultTimeZone } from "~/lib/format-preference"
import { sortCalendarMembers } from "~/lib/calendar-schedule"
import { useTRPC } from "~/lib/trpc/client"
import type { loader as rootLoader } from "~/root"

export function useCalendarState({ preview: showPreview = true }: { preview?: boolean } = {}) {
  const { preview } = useCalendarBookingPreview()
  const trpc = useTRPC()
  const organization = useQuery({ ...trpc.organizations.getCurrent.queryOptions(), ...calendarReferenceQueryOptions })
  const staff = useQuery({ ...trpc.staff.list.queryOptions(), ...calendarReferenceQueryOptions })
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const [searchParams, setSearchParams] = useSearchParams()
  const memberId = organization.data?.memberId
  const bookableMembers = sortCalendarMembers(staff.data?.filter((member) => member.isActive && member.acceptsAppointments) ?? [])
  const requestedMemberId = searchParams.get("member")
  const selectedMember = requestedMemberId
    ? bookableMembers.find((member) => member.id === requestedMemberId)
    : searchParams.get("scope") === "personal" && memberId ? bookableMembers.find((member) => member.memberId === memberId) : undefined
  const settings = organization.data?.settings
  const timeZone = settings?.timezone ?? root?.organizationTimezone ?? defaultTimeZone
  const calendarParams = new URLSearchParams(searchParams)
  if (showPreview && preview && (!selectedMember || preview.member.id === selectedMember.id)) calendarParams.set("date", calendarDateToValue(new TZDate(preview.startsAt, timeZone)))
  const dateState = getCalendarDateState(calendarParams, {
    timeZone,
    weekStartsOn: settings?.weekStartsOn ?? 1,
    defaultCalendarView: settings?.defaultCalendarView ?? "week",
  })

  return {
    ...dateState, organization, staff, bookableMembers, selectedMember, timeZone, searchParams, setSearchParams,
    formatPreference: root?.formatPreference ?? "eu",
    startMinute: (settings?.defaultStartHour ?? 8) * 60,
    endMinute: (settings?.defaultEndHour ?? 18) * 60,
  }
}
