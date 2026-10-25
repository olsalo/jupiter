import "dotenv/config"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createStaticHandler, createStaticRouter, Outlet, StaticRouterProvider } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/calendar-alert-placement",
  appType: "custom",
  resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/components": `${appPath}/components/ui`, "@coss/ui/lib": `${appPath}/lib` } },
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, retryOnMount: false } } })

try {
  const { default: CalendarPage } = await vite.ssrLoadModule("/app/routes/calendar/calendar.tsx")
  const { TRPCProvider, trpc } = await vite.ssrLoadModule("/app/lib/trpc/client.tsx") as typeof import("../app/lib/trpc/client")
  const { getCalendarDateState, getCalendarBookingRange } = await vite.ssrLoadModule("/app/lib/calendar/date.ts") as typeof import("../app/lib/calendar/date")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const i18n = createInstance()
  await i18n.init({ resources, lng: "en", defaultNS: "common", interpolation: { escapeValue: false } })
  const options = createTRPCOptionsProxy({ client: trpc, queryClient })
  const now = +new Date("2030-10-14T09:00:00Z")
  const timeZone = "Europe/Helsinki"
  const settings = { timezone: timeZone, defaultCalendarView: "week", weekStartsOn: 1 }
  const rootData = { org: { id: "business" }, organizations: [{ id: "business", role: "owner" }], formatPreference: "eu", organizationTimezone: timeZone }
  const handler = createStaticHandler([{
    id: "root", path: "/", Component: Outlet, loader: () => rootData,
    children: [{ id: "routes/calendar/calendar", path: "calendar", Component: CalendarPage, loader: () => ({ now }) }],
  }])

  for (const mode of ["day", "week", "list"] as const) {
    const search = new URLSearchParams({ view: mode, date: "2030-10-14" })
    const range = getCalendarBookingRange(getCalendarDateState(search, { now, timeZone, weekStartsOn: 1 }), timeZone)
    const bookingsKey = options.appointment.list.queryKey({ ...range, ...(mode === "list" ? { includeCancelled: true } : {}) })
    const scheduleKey = options.availability.calendarSchedule.queryKey(range)
    queryClient.setQueryData([...options.organizations.getCurrent.queryKey()], { id: "business", role: "owner", settings })
    queryClient.setQueryData([...options.staff.list.queryKey()], [{ id: "member", name: "Aino", isActive: true, acceptsAppointments: true }])
    queryClient.setQueryData(options.service.list.queryKey(), [])
    queryClient.setQueryData(options.service.bookingUsage.queryKey(), [])
    queryClient.setQueryData(bookingsKey, [])
    queryClient.setQueryData(scheduleKey, [])
    const failingQuery = queryClient.getQueryCache().find({ queryKey: mode === "list" ? bookingsKey : scheduleKey, exact: true })
    assert.ok(failingQuery)
    failingQuery.setState({ status: "error", error: new Error("Refresh failed") })
    const context = await handler.query(new Request(`https://example.invalid/calendar?${search}`))
    assert.ok(!(context instanceof Response))
    const router = createStaticRouter(handler.dataRoutes, context)
    const render = () => renderToStaticMarkup(createElement(I18nextProvider, { i18n },
      createElement(QueryClientProvider, { client: queryClient },
        createElement(TRPCProvider, { trpcClient: trpc, queryClient, children: createElement(StaticRouterProvider, { router, context, hydrate: false }) }))))
    const html = render()
    const containerAt = html.indexOf('data-slot="calendar-container"')
    const alertAt = html.indexOf('data-slot="alert"')
    assert.ok(containerAt > 0, `${mode} retains the visible calendar container with cached data`)
    assert.ok(alertAt > 0 && html.lastIndexOf('data-slot="alert"') < containerAt, `${mode} places all refresh alerts above the visible calendar container`)
    assert.ok(html.includes(i18n.t("calendarGrid.refreshError")))
    assert.ok(html.slice(alertAt, containerAt).includes(`>${i18n.t("retry")}</button>`), "The alert retains its retry action")

    if (mode !== "list") {
      queryClient.setQueryData(options.staff.list.queryKey(), [])
      const noMembers = render()
      assert.ok(noMembers.includes(i18n.t("calendarGrid.noMembers")))
      assert.ok(noMembers.lastIndexOf('data-slot="alert"') < noMembers.indexOf('data-slot="calendar-container"'), "The no-members alert is outside the calendar too")
    }

    failingQuery.setState({ status: "error", data: undefined, error: new Error("Load failed") })
    const loadError = render()
    assert.ok(loadError.includes(i18n.t("calendarGrid.loadError")))
    assert.ok(!loadError.includes('data-slot="calendar-container"'), "Initial load errors are displayed without enclosing the alert in a calendar frame")
  }
  console.info("PASS day, week and list alerts render above the calendar, including stale data, no members, initial failures and retry actions")
} finally {
  queryClient.clear()
  await vite.close()
}
