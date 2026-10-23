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
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/onboarding-ssr", appType: "custom", resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/components": `${appPath}/components/ui`, "@coss/ui/lib": `${appPath}/lib` } }, server: { middlewareMode: true, ws: false, hmr: false, watch: null } })
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
try {
  const { default: Availability } = await vite.ssrLoadModule("/app/routes/onboarding/availability.tsx") as typeof import("../app/routes/onboarding/availability")
  const { default: Holidays } = await vite.ssrLoadModule("/app/routes/onboarding/holidays.tsx") as typeof import("../app/routes/onboarding/holidays")
  const { TRPCProvider, trpc } = await vite.ssrLoadModule("/app/lib/trpc/client.tsx") as typeof import("../app/lib/trpc/client")
  const { defaultBusinessHolidays } = await vite.ssrLoadModule("/app/lib/business-holidays.ts") as typeof import("../app/lib/business-holidays")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const options = createTRPCOptionsProxy({ client: trpc, queryClient })
  queryClient.setQueryData(options.onboarding.schedule.queryKey(), {
    timezone: "Europe/Helsinki",
    workingHours: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startMinute: 540, endMinute: 1020, timezone: "Europe/Helsinki", isActive: true, validFrom: null, validUntil: null })),
    breaks: [],
    holidays: defaultBusinessHolidays(2027),
  })
  const i18n = createInstance()
  await i18n.init({ resources, lng: "en", defaultNS: "common", interpolation: { escapeValue: false } })
  const handler = createStaticHandler([{ id: "root", path: "/", Component: Outlet, loader: () => ({ locale: i18n.language, formatPreference: "eu" }), children: [{ path: "onboarding", Component: () => createElement(Outlet, { context: { nextStep: "subscription" } }), children: [{ path: "availability", Component: Availability }, { path: "holidays", Component: Holidays }] }] }])
  const render = async (step: string) => {
    const context = await handler.query(new Request(`https://example.invalid/onboarding/${step}`))
    assert.ok(!(context instanceof Response))
    const router = createStaticRouter(handler.dataRoutes, context)
    const routed = createElement(StaticRouterProvider, { router, context, hydrate: false })
    const provided = createElement(TRPCProvider, { trpcClient: trpc, queryClient, children: routed })
    return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(QueryClientProvider, { client: queryClient }, provided)))
  }
  const hours = await render("availability")
  assert.match(hours, /Set your usual hours/)
  assert.match(hours, /data-slot="working-hours-week"/)
  assert.equal((hours.match(/name="workingHours\[\d+\]\.startMinute"/g) ?? []).length, 5)
  assert.match(hours, /noValidate=""/i)
  assert.doesNotMatch(hours, /Reset to business working hours/)
  const holidays = await render("holidays")
  assert.match(holidays, /Confirm your holidays/)
  assert.match(holidays, /Christmas Day/)
  assert.match(holidays, /Add holiday/)
  assert.match(holidays, /Continue/)
  await i18n.changeLanguage("fi")
  assert.match(await render("availability"), /Valitse tavalliset aukioloajat/)
  assert.match(await render("holidays"), /Vahvista pyhäpäivät/)
  console.info("PASS onboarding availability and holiday route rendering, weekly editor, RVF forms and English/Finnish labels")
} finally {
  queryClient.clear()
  await vite.close()
}
