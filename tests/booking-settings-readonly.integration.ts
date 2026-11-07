import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/booking-settings-readonly", appType: "custom", resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/components": `${appPath}/components/ui`, "@coss/ui/lib": `${appPath}/lib` } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
try {
  const { BookingSettings } = await vite.ssrLoadModule("/app/components/settings/business/booking-settings.tsx") as typeof import("../app/components/settings/business/booking-settings")
  const { BookingPageSwitch } = await vite.ssrLoadModule("/app/components/booking-page/booking-page-switch.tsx") as typeof import("../app/components/booking-page/booking-page-switch")
  const { TRPCProvider, trpc } = await vite.ssrLoadModule("/app/lib/trpc/client.tsx") as typeof import("../app/lib/trpc/client")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const { defaultBookingSettings } = await vite.ssrLoadModule("/app/lib/schemas/booking-settings.ts") as typeof import("../app/lib/schemas/booking-settings")
  const options = createTRPCOptionsProxy({ client: trpc, queryClient })
  queryClient.setQueryData(options.organizations.bookingSettings.queryKey(), defaultBookingSettings)
  const i18n = createInstance()
  await i18n.init({ resources, lng: "fi", defaultNS: "common", interpolation: { escapeValue: false } })
  let subscriptionReadOnly = false
  let pageSwitch = false
  const handler = createStaticHandler([{ id: "root", path: "/", loader: () => ({ subscriptionReadOnly }), Component: () => pageSwitch ? createElement(BookingPageSwitch, { name: "isActive", checked: false, disabled: subscriptionReadOnly }) : createElement(BookingSettings, { onFormStateChange: () => {}, resetRef: { current: null } }) }])
  async function render() {
    const context = await handler.query(new Request("https://example.invalid/"))
    assert.ok(!(context instanceof Response))
    const router = createStaticRouter(handler.dataRoutes, context)
    const routed = createElement(StaticRouterProvider, { router, context, hydrate: false })
    return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(QueryClientProvider, { client: queryClient }, createElement(TRPCProvider, { queryClient, trpcClient: trpc, children: routed }))))
  }
  const active = await render()
  const activeSwitch = active.match(/<span\b[^>]*role="switch"[^>]*>/)?.[0] ?? ""
  assert.match(activeSwitch, /aria-checked="true"/)
  assert.doesNotMatch(activeSwitch, /disabled=""/)
  subscriptionReadOnly = true
  const inactive = await render()
  const switches = inactive.match(/<span\b[^>]*role="switch"[^>]*>/g) ?? []
  assert.match(switches[0] ?? "", /aria-checked="false"/)
  assert.match(switches[0] ?? "", /aria-disabled="true"/)
  assert.doesNotMatch(switches[1] ?? "", /aria-disabled="true"/, "Other booking settings remain editable")
  assert.match(inactive, /Asetuksen muuttamiseen tarvitaan aktiivinen tilaus/)
  pageSwitch = true
  const inactivePageSwitch = await render()
  assert.match(inactivePageSwitch, /Varaussivu on käytössä/)
  assert.doesNotMatch(inactivePageSwitch, /Asetuksen muuttamiseen tarvitaan aktiivinen tilaus/)
  subscriptionReadOnly = false
  assert.doesNotMatch(await render(), /Asetuksen muuttamiseen tarvitaan aktiivinen tilaus/)
  console.info("PASS inactive subscriptions display online booking as off and disabled without disabling other settings")
} finally {
  queryClient.clear()
  await vite.close()
}
