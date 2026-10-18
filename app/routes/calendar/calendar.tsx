import { dehydrate } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Outlet } from "react-router"

import { RouteInformationArchitecture } from "~/components/information-architecture/route-information-architecture"
import { CalendarDateControls } from "~/components/calendar-date-controls"
import { CalendarViewSwitch } from "~/components/calendar-view-switch"
import { CalendarMemberSelect } from "~/components/calendar/calendar-member-select"
import { CalendarHeaderActions } from "~/components/calendar-header-actions"
import { CalendarWeekView } from "~/components/calendar/calendar-week-view"
import { CalendarBookingPreviewProvider } from "~/components/calendar/calendar-booking-preview"
import { useCalendarState } from "~/components/calendar/use-calendar-state"
import { PageHeader } from "~/components/page-header"
import { getCalendarBookingRange, getCalendarDateState } from "~/lib/calendar-date"
import { defaultTimeZone } from "~/lib/format-preference"
import { shouldRevalidateAppRoute } from "~/lib/should-revalidate"
import { getQueryClient } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import type { Route } from "./+types/calendar"

export async function loader(loaderArgs: Route.LoaderArgs) {
  const queryClient = getQueryClient()
  const trpc = await createTRPC(loaderArgs)
  const [organization] = await Promise.all([
    queryClient.fetchQuery(trpc.organizations.getCurrent.queryOptions()).catch(() => undefined),
    queryClient.fetchQuery(trpc.staff.list.queryOptions()).catch(() => undefined),
  ])
  if (organization) {
    const settings = organization.settings
    const timeZone = settings?.timezone ?? defaultTimeZone
    const state = getCalendarDateState(new URL(loaderArgs.request.url).searchParams, {
      timeZone: settings?.timezone ?? defaultTimeZone,
      weekStartsOn: settings?.weekStartsOn ?? 1,
      defaultCalendarView: settings?.defaultCalendarView ?? "week",
    })
    const range = getCalendarBookingRange(state, timeZone)
    if (state.mode === "week" || state.mode === "day") await Promise.all([
      queryClient.fetchQuery(trpc.availability.calendarSchedule.queryOptions(range)).catch(() => undefined),
      queryClient.fetchQuery(trpc.appointment.list.queryOptions(range)).catch(() => undefined),
    ])
  }
  return { queryClient: dehydrate(queryClient) }
}

export function clientLoader() {
  // Client queries own fetching and freshness after the initial server render
  return null
}

export const shouldRevalidate = shouldRevalidateAppRoute

export const handle = { workspace: true, contained: true, pageHeader: { titleKey: "calendar", createTitleKey: "newAppointment" } }

export default function Page() {
  return <CalendarBookingPreviewProvider><CalendarContent /></CalendarBookingPreviewProvider>
}

function CalendarContent() {
  const { t } = useTranslation()
  const { mode } = useCalendarState()
  const title = t("routeTitles.calendar")

  return <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
    <title>{title}</title>
    <PageHeader
      actions={<CalendarHeaderActions />}
      className="route-mobile-header shrink-0 max-md:gap-3 md:hidden"
      description={t("routeDescriptions.calendar")}
      showDescriptionOnMobile={true}
      title={title}
    />
    <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-3" data-slot="calendar-view-controls">
      <div className="flex min-w-0 flex-wrap items-center gap-3 max-md:w-full">
        <CalendarDateControls />
        <CalendarViewSwitch />
      </div>
      <div className="flex min-w-0 items-center max-sm:w-full">
        <CalendarMemberSelect />
      </div>
    </div>
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border bg-background" data-slot="calendar-container">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {mode === "week" || mode === "day" ? <CalendarWeekView /> : <div className="@container min-h-0 min-w-0 flex-1 overflow-y-auto">
          <RouteInformationArchitecture section="calendar" icon="calendar" />
        </div>}
      </div>
      <Outlet />
    </div>
  </section>
}
