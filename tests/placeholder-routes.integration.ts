import "dotenv/config"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import { createStaticHandler, createStaticRouter, matchRoutes, Outlet, StaticRouterProvider, type RouteObject } from "react-router"
import { createServer } from "vite"
import type { RouteConfigEntry } from "@react-router/dev/routes"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({
  configFile: false, appType: "custom",
  resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/components": `${appPath}/components/ui`, "@coss/ui/lib": `${appPath}/lib` } },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
})
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
try {
  const { default: config } = await vite.ssrLoadModule("/app/routes.ts") as { default: RouteConfigEntry[] }
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const { TRPCProvider, trpc } = await vite.ssrLoadModule("/app/lib/trpc/client.tsx") as typeof import("../app/lib/trpc/client")
  const options = createTRPCOptionsProxy({ client: trpc, queryClient })
  queryClient.setQueryData(options.staff.list.queryKey(), [])
  queryClient.setQueryData(options.location.list.queryKey(), [])
  queryClient.setQueryData(options.organizations.general.queryKey(), { businessName: "Test business", businessId: null, weekStartsOn: 1, country: "FI", currency: "EUR", location: "FI", timezone: "Europe/Helsinki", canManage: true })
  const i18n = createInstance()
  await i18n.init({ resources, lng: "en", fallbackLng: "en", defaultNS: "common", interpolation: { escapeValue: false } })
  const existing = new Set(["routes/layout.tsx", "routes/overview.tsx", "routes/team/team.tsx", "routes/auth.tsx", "routes/invite.tsx", "routes/not-found.tsx"])
  async function convert(entries: RouteConfigEntry[]): Promise<RouteObject[]> {
    const converted: RouteObject[] = []
    for (const entry of entries) {
      const skip = existing.has(entry.file) || entry.file.startsWith("routes/team/") || entry.file.startsWith("routes/example/") || entry.file.startsWith("routes/api/") || entry.file.startsWith("routes/onboarding/")
      const module = skip ? { default: Outlet, handle: undefined } : await vite.ssrLoadModule(`/app/${entry.file}`)
      const shared = { id: entry.file, Component: module.default, handle: module.handle }
      converted.push(entry.index ? { ...shared, index: true } : { ...shared, path: entry.path, children: entry.children ? await convert(entry.children) : undefined })
    }
    return converted
  }
  const routes = await convert(config)
  for (const pathname of ["/calendar", "/calendar/new", "/calendar/appt-123/edit", "/calendar/appt-123/reschedule", "/customers/new", "/customers/customer-123", "/services/service-123/intake", "/booking-pages/page-123/edit", "/team", "/example/new"]) {
    const matches = matchRoutes(routes, pathname)
    assert.ok(matches)
    assert.ok(matches.some((match) => match.route.id === "routes/layout.tsx"), `${pathname} stays in the authenticated layout`)
    assert.notEqual(matches.at(-1)?.route.id, "routes/not-found.tsx")
  }
  for (const pathname of ["/book/business", "/book/business/page", "/booking/secret", "/booking/secret/cancel", "/booking/secret/reschedule"]) {
    const matches = matchRoutes(routes, pathname)
    assert.ok(matches?.length)
    assert.equal(matches.some((match) => match.route.id === "routes/layout.tsx"), false)
    assert.notEqual(matches.at(-1)?.route.id, "routes/not-found.tsx")
  }
  for (const pathname of ["/settings/general", "/appointments", "/availability", "/my-schedule", "/locations/new"]) {
    assert.equal(matchRoutes(routes, pathname)?.at(-1)?.route.id, "routes/not-found.tsx")
  }
  const handler = createStaticHandler(routes)
  async function render(pathname: string) {
    const context = await handler.query(new Request(`https://example.invalid${pathname}`))
    assert.ok(!(context instanceof Response))
    const router = createStaticRouter(handler.dataRoutes, context)
    const routed = createElement(StaticRouterProvider, { router, context, hydrate: false })
    const provided = createElement(TRPCProvider, { queryClient, trpcClient: trpc, children: routed })
    return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(QueryClientProvider, { client: queryClient }, provided)))
  }
  for (const pathname of ["/calendar?view=day", "/customers", "/services", "/booking-pages"]) {
    const markup = await render(pathname)
    assert.match(markup, /data-slot="route-information-architecture"/)
    assert.match(markup, /Information architecture/)
    assert.match(markup, /Planned actions/)
    assert.doesNotMatch(markup, /This view is coming soon/)
  }
  const bookingPage = await render("/booking-pages")
  assert.match(bookingPage, /The MVP has one Booking page/)
  assert.doesNotMatch(bookingPage, /New booking page/)
  const create = await render("/services/new")
  assert.match(create, /New service/)
  assert.match(create, /data-slot="sheet-popup"/)
  assert.match(create, /data-slot="sheet-title"/)
  assert.match(create, /Create service/)
  assert.doesNotMatch(create, /This view is coming soon/)
  assert.equal((create.match(/data-slot="sheet-popup"/g) ?? []).length, 1)
  const edit = await render("/services/service-123/edit")
  assert.match(edit, /Edit service/)
  assert.match(edit, /href="\/services\/service-123"/)
  assert.equal((edit.match(/data-slot="sheet-popup"/g) ?? []).length, 1, "Edit shares one sheet with the detail route")
  const detail = await render("/calendar/appt-123")
  assert.match(detail, /href="\/calendar\/appt-123\/edit"/)
  assert.match(detail, /href="\/calendar\/appt-123\/reschedule"/)
  const booking = await render("/booking/secret")
  assert.match(booking, /Your booking/)
  assert.match(booking, /href="\/booking\/secret\/cancel"/)
  await i18n.changeLanguage("fi")
  assert.equal(matchRoutes(routes, "/staff")?.at(-1)?.route.id, "routes/not-found.tsx")
  const finnishCalendar = await render("/calendar?view=day")
  assert.match(finnishCalendar, /Tietorakenne/)
  assert.match(finnishCalendar, /Viikoittaiset työajat/)
  assert.doesNotMatch(finnishCalendar, /Information architecture|Planned actions/)
  const finnish = await render("/services/new")
  assert.match(finnish, /Uusi palvelu/)
  assert.match(finnish, /Luo palvelu/)
  assert.doesNotMatch(finnish, /Tämä näkymä on tulossa pian/)
  console.info("PASS protected/private route structure, public booking paths, existing team/example routes, no settings pages, sheet SSR/deep links, shared edit sheet and Finnish placeholders")
} finally {
  queryClient.clear()
  await vite.close()
}
