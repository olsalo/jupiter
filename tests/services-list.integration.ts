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
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/services-list", appType: "custom", resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/components": `${appPath}/components/ui`, "@coss/ui/lib": `${appPath}/lib` } }, server: { middlewareMode: true, ws: false, hmr: false, watch: null } })
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
try {
  const { default: Services } = await vite.ssrLoadModule("/app/routes/services/services.tsx") as typeof import("../app/routes/services/services")
  const { ServiceCategoryProvider } = await vite.ssrLoadModule("/app/components/services/service-category-controls.tsx") as typeof import("../app/components/services/service-category-controls")
  const { TRPCProvider, trpc } = await vite.ssrLoadModule("/app/lib/trpc/client.tsx") as typeof import("../app/lib/trpc/client")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const options = createTRPCOptionsProxy({ client: trpc, queryClient })
  queryClient.setQueryData(options.service.categories.queryKey(), [])
  const i18n = createInstance()
  await i18n.init({ resources, lng: "en", defaultNS: "common", interpolation: { escapeValue: false } })
  let role = "owner"
  const ServicesWithHeader = () => createElement(ServiceCategoryProvider, { children: createElement(Services) })
  const handler = createStaticHandler([{ id: "root", path: "/", Component: Outlet, loader: () => ({ locale: i18n.language, org: { id: "org" }, organizations: [{ id: "org", role }], formatPreference: "eu" }), children: [{ path: "services", Component: ServicesWithHeader }] }])
  async function render(path = "/services") {
    const context = await handler.query(new Request(`https://example.invalid${path}`))
    assert.ok(!(context instanceof Response))
    const router = createStaticRouter(handler.dataRoutes, context)
    const routed = createElement(StaticRouterProvider, { router, context, hydrate: false })
    const provided = createElement(TRPCProvider, { queryClient, trpcClient: trpc, children: routed })
    return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(QueryClientProvider, { client: queryClient }, provided)))
  }
  queryClient.setQueryData([...options.service.list.queryKey()], [])
  assert.match(await render(), /No services yet/)
  const service = { id: "service-1", name: "Consultation", sortOrder: 0, durationMinutes: 30, deliveryType: "ONLINE" as const, isActive: true, price: "25.50", currency: "EUR", color: "#8f49b5", description: "A short consultation", organizationId: "org", categoryId: null, slug: "consultation", bufferBeforeMinutes: 0, bufferAfterMinutes: 0,
    paymentRequirement: "NONE" as const, depositAmount: null, maxAttendees: 1, minBookingNoticeMinutes: 0, maxBookingAdvanceDays: null,
    cancellationNoticeMinutes: null, rescheduleNoticeMinutes: null, requiresConfirmation: false, allowWaitlist: false, image: null, deletedAt: null, createdAt: new Date(), updatedAt: new Date() }
  queryClient.setQueryData([...options.service.list.queryKey()], [service, { ...service, id: "service-2", name: "Haircut", sortOrder: 1, isActive: false, deliveryType: "IN_PERSON" }])
  const english = await render()
  assert.match(english, /<title>Services<\/title>/)
  assert.match(english, /data-slot="icon-list-item"/)
  assert.match(english, /aria-label="Category: All services"/)
  assert.match(english, /data-slot="badge"[^>]*>2<\/span>/)
  assert.doesNotMatch(english, />Edit<\/button>|>Delete<\/button>/)
  assert.match(english, /aria-label="Move Consultation"/)
  assert.match(english, /aria-label="Actions for Consultation"/)
  assert.match(english, /aria-label="Actions for Haircut"/)
  assert.match(english, /href="\/services\/service-1\/edit"/)
  assert.match(english, /30 min/)
  assert.match(english, /25,50/)
  assert.match(english, /Hidden from booking page/)
  assert.doesNotMatch(english, /Drag services to change their order|Saving order/)
  assert.ok(english.indexOf("Consultation") < english.indexOf("Haircut"))
  assert.doesNotMatch(english, /Information architecture|MVP plan|\[object Object\]/)
  const category = { id: "consultations", name: "Consultations", organizationId: "org", description: null, sortOrder: 0, isActive: true, createdAt: new Date(), updatedAt: new Date() }
  queryClient.setQueryData(options.service.categories.queryKey(), [category])
  queryClient.setQueryData([...options.service.list.queryKey()], [{ ...service, categoryId: category.id }, { ...service, id: "service-2", name: "Haircut" }])
  const selected = await render("/services?category=consultations")
  assert.match(selected, /<title>Services<\/title>/)
  assert.doesNotMatch(selected, /<h2[^>]*>Consultations<\/h2>/)
  const desktopHeader = selected.match(/<header\b[^>]*route-header[^>]*>([\s\S]*?)<\/header>/)?.[1]
  assert.ok(desktopHeader)
  assert.match(desktopHeader, /aria-label="Category: Consultations"/)
  assert.match(desktopHeader, /aria-label="Edit"/)
  assert.match(desktopHeader, /aria-label="Delete"/)
  assert.doesNotMatch(desktopHeader, /disabled=""/)
  assert.match(selected, /Consultation/)
  assert.doesNotMatch(selected, /Haircut|role="status"/)
  queryClient.setQueryData(options.service.categories.queryKey(), [])
  queryClient.setQueryData([...options.service.list.queryKey()], [{ ...service, price: null }])
  const unsetPrice = await render()
  assert.doesNotMatch(unsetPrice, /0,00|25,50/)
  queryClient.setQueryData([...options.service.list.queryKey()], [{ ...service, price: "0" }])
  assert.match(await render(), /0,00/)
  queryClient.setQueryData([...options.service.list.queryKey()], [service, { ...service, id: "service-2", name: "Haircut", sortOrder: 1, isActive: false, deliveryType: "IN_PERSON" }])
  role = "member"
  const member = await render()
  assert.doesNotMatch(member, /href="\/services\/new"|Drag services to change their order|aria-label="Move Consultation"|>Edit<\/button>/)
  assert.match(member, /Consultation/)
  assert.match(member, /href="\/services\/service-1"/)
  assert.doesNotMatch(member, /Actions for Consultation|Actions for Haircut/)
  await i18n.changeLanguage("fi")
  role = "owner"
  const finnish = await render()
  assert.doesNotMatch(finnish, /Muuta palveluiden järjestystä vetämällä|Tallennetaan järjestystä/)
  assert.match(finnish, /Piilotettu varaussivulta/)
  assert.match(finnish, /Siirrä palvelua Consultation/)
  queryClient.setQueryData([...options.service.list.queryKey()], [])
  assert.match(await render(), /Ei vielä palveluita/)
  console.info("PASS service list SSR, saved order, service details, empty state, permissions and Finnish labels")
} finally {
  queryClient.clear()
  await vite.close()
}
