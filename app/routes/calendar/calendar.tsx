import { dehydrate } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Outlet } from "react-router"

import { CalendarAgenda } from "~/components/calendar/calendar-agenda"
import { CalendarHeaderActions } from "~/components/calendar/header-actions"
import { CalendarSchedule } from "~/components/calendar/calendar-schedule"
import { CalendarViewControls } from "~/components/calendar/calendar-view-controls"
import { CalendarBookingPreviewProvider } from "~/components/calendar/calendar-booking-preview"
import { useCalendarState } from "~/components/calendar/use-calendar-state"
import { RouteHeader } from "~/components/layout/route-header"
import { ScrollPage, ViewportPage } from "~/components/layout/page-layout"
import { getCalendarBookingRange, getCalendarDateState } from "~/lib/calendar/date"
import { defaultTimeZone } from "~/lib/localization/format-preference"
import { resolvePageLayout } from "~/lib/routing/page-layout"
import { shouldRevalidateAppRoute } from "~/lib/routing/should-revalidate"
import { getQueryClient } from "~/lib/trpc/client"
import { createTRPC } from "~/lib/trpc/server"
import type { Route } from "./+types/calendar"

export async function loader(loaderArgs: Route.LoaderArgs) {
  const now = Date.now()
  const queryClient = getQueryClient()
  const trpc = await createTRPC(loaderArgs)
  const staffPromise = queryClient.query(trpc.staff.list.queryOptions()).catch(() => undefined)
  const organization = await queryClient.query(trpc.organizations.getCurrent.queryOptions()).catch(() => undefined)
  if (organization) {
    const settings = organization.settings
    const timeZone = settings?.timezone ?? defaultTimeZone
    const state = getCalendarDateState(new URL(loaderArgs.request.url).searchParams, {
      now,
      timeZone: settings?.timezone ?? defaultTimeZone,
      weekStartsOn: settings?.weekStartsOn ?? 1,
      defaultCalendarView: settings?.defaultCalendarView ?? "week",
    })
    const range = getCalendarBookingRange(state, timeZone)
    await Promise.all([
      ...(state.mode !== "list" ? [queryClient.query(trpc.availability.calendarSchedule.queryOptions(range)).catch(() => undefined)] : []),
      queryClient.query(trpc.appointment.list.queryOptions({ ...range, includeCancelled: false })).catch(() => undefined),
    ])
  }
  await staffPromise
  return { now, queryClient: dehydrate(queryClient) }
}

export function clientLoader() {
  // Client queries own fetching and freshness after the initial server render
  return { now: Date.now() }
}

export const shouldRevalidate = shouldRevalidateAppRoute

export const handle = { workspace: true, pageLayout: "viewport-desktop" } as const

export default function CalendarRoute() {
  return <CalendarBookingPreviewProvider><CalendarRouteContent /></CalendarBookingPreviewProvider>
}

function CalendarRouteContent() {
  const { t } = useTranslation()
  const { mode, isMobile } = useCalendarState()
  const title = t("routeTitles.calendar")
  const Layout = resolvePageLayout(handle.pageLayout, isMobile) === "scroll" ? ScrollPage : ViewportPage

  return <Layout header={<RouteHeader
    actions={<CalendarHeaderActions />}
    mobileControls={<CalendarViewControls mobile={true} />}
    description={t("routeDescriptions.calendar")}
    showDescriptionOnMobile={false}
    title={title}
  />}>
    <title>{title}</title>
    <CalendarViewControls className="hidden md:flex" />
    <div className="flex min-h-0 min-w-0 flex-1 gap-4" data-slot="calendar-layout">
      {mode === "list" ? <CalendarAgenda /> : <CalendarSchedule />}
      <Outlet />
    </div>
  </Layout>
}
