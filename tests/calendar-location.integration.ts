import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createStaticHandler, createStaticRouter, Outlet, StaticRouterProvider } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import { createServer } from "vite"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/calendar-location",
  appType: "custom",
  resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/lib": `${appPath}/lib`, "@coss/ui/components": `${appPath}/components/ui` } },
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
try {
  const { useCalendarState } = await vite.ssrLoadModule("/app/components/calendar/use-calendar-state.ts") as typeof import("../app/components/calendar/use-calendar-state")
  const { useBusinessWorkingHours } = await vite.ssrLoadModule("/app/components/team/use-business-working-hours.ts") as typeof import("../app/components/team/use-business-working-hours")
  const { getCalendarBookingRange, calendarDateToValue } = await vite.ssrLoadModule("/app/lib/calendar/date.ts") as typeof import("../app/lib/calendar/date")
  const { TRPCProvider, trpc } = await vite.ssrLoadModule("/app/lib/trpc/client.tsx") as typeof import("../app/lib/trpc/client")
  const options = createTRPCOptionsProxy({ client: trpc, queryClient })
  const locations = [
    { id: "second", name: "A location", timezone: "America/New_York", isActive: true, createdAt: new Date("2026-02-01") },
    { id: "first", name: "Z location", timezone: "Europe/Helsinki", isActive: true, createdAt: new Date("2026-01-01") },
    { id: "archived", name: "Old location", timezone: "Asia/Tokyo", isActive: false, createdAt: new Date("2025-01-01") },
  ]
  const setOrganization = (defaultLocationId: string | null) => queryClient.setQueryData([...options.organizations.getCurrent.queryKey()], {
    id: "business", settings: { timezone: "Europe/Helsinki", defaultLocationId, weekStartsOn: 1, defaultCalendarView: "day" },
  })
  queryClient.setQueryData([...options.location.list.queryKey()], locations)
  queryClient.setQueryData(options.staff.list.queryKey(), [])
  queryClient.setQueryData(options.availability.getRules.queryKey({}), [])
  function CalendarState() {
    const calendar = useCalendarState()
    const hours = useBusinessWorkingHours()
    const range = getCalendarBookingRange(calendar, calendar.timeZone)
    return createElement("div", {
      "data-timezone": calendar.timeZone,
      "data-location": calendar.location?.id,
      "data-day": calendarDateToValue(calendar.selected),
      "data-range-start": range.from.toISOString(),
      "data-range-end": range.to.toISOString(),
      "data-hours-timezone": hours.timezone,
    })
  }
  const handler = createStaticHandler([{ id: "root", path: "/", Component: Outlet, loader: () => ({ locale: "en", formatPreference: "eu", organizationTimezone: "Europe/Helsinki" }), children: [{ id: "routes/calendar/calendar", path: "calendar", Component: CalendarState, loader: () => ({ now: Date.parse("2026-11-03T01:00:00Z") }) }] }])
  const render = async () => {
    const context = await handler.query(new Request("https://example.invalid/calendar"))
    assert.ok(!(context instanceof Response))
    const router = createStaticRouter(handler.dataRoutes, context)
    const routed = createElement(StaticRouterProvider, { router, context, hydrate: false })
    const provided = createElement(TRPCProvider, { trpcClient: trpc, queryClient, children: routed })
    return renderToStaticMarkup(createElement(QueryClientProvider, { client: queryClient }, provided))
  }
  setOrganization("second")
  const newYork = await render()
  assert.match(newYork, /data-timezone="America\/New_York"/)
  assert.match(newYork, /data-location="second"/)
  assert.match(newYork, /data-day="2026-11-02"/, "Calendar dates use the location's local day")
  assert.match(newYork, /data-range-start="2026-11-02T05:00:00.000Z"/, "Booking queries start at local midnight after the US daylight saving change")
  assert.match(newYork, /data-range-end="2026-11-03T05:00:00.000Z"/)
  assert.match(newYork, /data-hours-timezone="America\/New_York"/, "Schedule editors use the calendar's location timezone")
  setOrganization(null)
  const oldest = await render()
  assert.match(oldest, /data-location="first"/, "The fallback is the oldest active location, not alphabetical order")
  assert.match(oldest, /data-day="2026-11-03"/)
  setOrganization("archived")
  assert.match(await render(), /data-location="first"/, "Archived defaults are ignored")
  setOrganization("second")
  queryClient.setQueryData([...options.location.list.queryKey()], locations.map((location) => ({ ...location, timezone: null })))
  assert.match(await render(), /data-timezone="Europe\/Helsinki"/, "Legacy locations without a timezone use the business timezone")
  queryClient.setQueryData(options.location.list.queryKey(), [])
  assert.match(await render(), /data-timezone="Europe\/Helsinki"/, "Businesses without locations keep a usable calendar")
  console.info("PASS calendar and schedule editor location timezones, default/oldest active location selection, local date/query boundaries, archived locations and legacy fallbacks")
} finally {
  queryClient.clear()
  await vite.close()
}
