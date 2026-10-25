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
  configFile: false, cacheDir: "node_modules/.vite-tests/calendar-booking-panel", appType: "custom",
  resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/components": `${appPath}/components/ui`, "@coss/ui/lib": `${appPath}/lib` } },
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })

try {
  const { CalendarBookingEdit } = await vite.ssrLoadModule("/app/components/calendar/calendar-booking-edit.tsx") as typeof import("../app/components/calendar/calendar-booking-edit")
  const { TRPCProvider, trpc } = await vite.ssrLoadModule("/app/lib/trpc/client.tsx") as typeof import("../app/lib/trpc/client")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const options = createTRPCOptionsProxy({ client: trpc, queryClient })
  const i18n = createInstance()
  await i18n.init({ resources, lng: "en", defaultNS: "common", interpolation: { escapeValue: false } })
  const service = { id: "service", name: "Consultation", isActive: true, durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 }
  const staffMember = { id: "staff", name: "Aino", isActive: true, acceptsAppointments: true, memberId: "member" }
  const customer = { id: "customer", firstName: "Matti", lastName: "Virtanen", email: null, phone: null }
  queryClient.setQueryData([...options.organizations.getCurrent.queryKey()], { id: "business", role: "owner", memberId: "member", settings: { timezone: "Europe/Helsinki" } })
  queryClient.setQueryData([...options.staff.list.queryKey()], [staffMember])
  queryClient.setQueryData([...options.service.list.queryKey()], [service])
  queryClient.setQueryData([...options.service.get.queryKey({ id: service.id })], { ...service, staffServices: [] })
  queryClient.setQueryData([...options.customer.get.queryKey({ id: customer.id })], customer)
  queryClient.setQueryData([...options.appointment.get.queryKey({ id: "booking" })], {
    id: "booking", startsAt: new Date("2030-10-14T07:00:00Z"), endsAt: new Date("2030-10-14T07:30:00Z"),
    status: "CONFIRMED", timezone: "Europe/Helsinki", customerId: customer.id, customer,
    staffMemberId: staffMember.id, staffMember, locationId: null, internalNotes: "Booking notes", customerNotes: null, answers: [],
    services: [{ ...service, id: "booked-service", serviceId: service.id, service }],
  })
  const rootData = { org: { id: "business" }, organizations: [{ id: "business", role: "owner" }], formatPreference: "eu" }
  const handler = createStaticHandler([{
    id: "root", path: "/", Component: Outlet, loader: () => rootData,
    children: [{ path: "calendar/:appointmentId/edit", Component: CalendarBookingEdit }],
  }])
  const context = await handler.query(new Request("https://example.invalid/calendar/booking/edit?date=2030-10-14"))
  assert.ok(!(context instanceof Response))
  const router = createStaticRouter(handler.dataRoutes, context)
  const markup = renderToStaticMarkup(createElement(I18nextProvider, { i18n },
    createElement(QueryClientProvider, { client: queryClient },
      createElement(TRPCProvider, { trpcClient: trpc, queryClient, children: createElement(StaticRouterProvider, { router, context, hydrate: false }) }))))
  assert.match(markup, /data-slot="calendar-side-panel"/, "Desktop bookings render in an inline panel without an overlay root")
  assert.match(markup, /data-slot="drawer-footer"/, "Booking actions render without requiring dialog context")
  assert.match(markup, /type="submit"/, "The save button remains available")
  assert.match(markup, /Booking notes/, "The loaded booking form renders")
  assert.doesNotMatch(markup, /role="dialog"/, "The desktop panel does not need a modal wrapper")
  console.info("PASS desktop booking panel renders its form and footer without dialog context")
} finally {
  queryClient.clear()
  await vite.close()
}
