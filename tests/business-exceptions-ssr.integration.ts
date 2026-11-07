import assert from "node:assert/strict"
import type { BusinessHolidayValues } from "../app/lib/schemas/business-schedule"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createStaticHandler, createStaticRouter, Outlet, StaticRouterProvider } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/business-exceptions-ssr", appType: "custom", resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/components": `${appPath}/components/ui`, "@coss/ui/lib": `${appPath}/lib` } }, server: { middlewareMode: true, ws: false, hmr: false, watch: null } })
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
try {
  const { BusinessExceptionsSettings } = await vite.ssrLoadModule("/app/components/settings/business/business-exceptions-settings.tsx") as typeof import("../app/components/settings/business/business-exceptions-settings")
  const { BusinessScheduleSettings } = await vite.ssrLoadModule("/app/components/settings/business/business-schedule-settings.tsx") as typeof import("../app/components/settings/business/business-schedule-settings")
  const { BusinessHolidayFormFields } = await vite.ssrLoadModule("/app/components/settings/business/business-holiday-form-fields.tsx") as typeof import("../app/components/settings/business/business-holiday-form-fields")
  const { BusinessSettingsHeader } = await vite.ssrLoadModule("/app/components/settings/business/business-settings-header.tsx") as typeof import("../app/components/settings/business/business-settings-header")
  const { AppForm } = await vite.ssrLoadModule("/app/components/forms/app-form.tsx") as typeof import("../app/components/forms/app-form")
  const { Tabs } = await vite.ssrLoadModule("/app/components/ui/tabs.tsx") as typeof import("../app/components/ui/tabs")
  const { businessExceptionSchema } = await vite.ssrLoadModule("/app/lib/schemas/business-schedule.ts") as typeof import("../app/lib/schemas/business-schedule")
  const { TRPCProvider, trpc } = await vite.ssrLoadModule("/app/lib/trpc/client.tsx") as typeof import("../app/lib/trpc/client")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const options = createTRPCOptionsProxy({ client: trpc, queryClient })
  queryClient.setQueryData([...options.organizations.getCurrent.queryKey()], { id: "business", name: "Studio Helmi", settings: { timezone: "Europe/Helsinki", businessHolidays: { exceptions: [] } } })
  queryClient.setQueryData(options.location.list.queryKey(), [])
  queryClient.setQueryData(options.availability.getRules.queryKey({}), [])
  queryClient.setQueryData(options.organizations.businessHolidays.queryKey(), [])
  const i18n = createInstance()
  await i18n.init({ resources, lng: "fi", defaultNS: "common", interpolation: { escapeValue: false } })
  let content: ReturnType<typeof createElement>
  const handler = createStaticHandler([{ id: "root", path: "/", Component: Outlet, loader: () => ({ locale: "fi", formatPreference: "eu" }), children: [{ index: true, Component: () => content }] }])
  const render = async (children: ReturnType<typeof createElement>) => {
    content = children
    const context = await handler.query(new Request("https://example.invalid/"))
    assert.ok(!(context instanceof Response))
    const router = createStaticRouter(handler.dataRoutes, context)
    const routed = createElement(StaticRouterProvider, { router, context, hydrate: false })
    const provided = createElement(TRPCProvider, { trpcClient: trpc, queryClient, children: routed })
    return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(QueryClientProvider, { client: queryClient }, provided)))
  }
  const header = await render(createElement(Tabs, { value: "exceptions" }, createElement(BusinessSettingsHeader, { name: "Studio Helmi" })))
  assert.match(header, /Poikkeusaukioloajat/)
  const exceptions = await render(createElement(BusinessExceptionsSettings))
  assert.match(exceptions, /Poikkeusaukioloajat/)
  assert.match(exceptions, /Lisää poikkeus/)
  assert.doesNotMatch(exceptions, /<form/, "The exceptions tab has no outer schedule form")
  const hours = await render(createElement(Tabs, { value: "opening-hours" }, createElement(BusinessScheduleSettings, { activeTab: "opening-hours", onTabChange: () => {}, onFormStateChange: () => {}, resetRef: { current: null } })))
  assert.match(hours, /data-slot="working-hours-week"/)
  assert.doesNotMatch(hours, /Lisää poikkeus|Ei lisättyjä poikkeuksia/, "One-off exceptions no longer appear below weekly hours")
  const renderFields = (closed: boolean) => render(createElement(AppForm<BusinessHolidayValues, BusinessHolidayValues, unknown>, {
    defaultValues: { id: "exception-preview", name: "Special day", date: "2026-12-24", enabled: true, closed, startMinute: 540, endMinute: 1020 },
    schema: businessExceptionSchema,
    otherFormProps: { noValidate: true },
    submitFn: async () => {},
    children: (form) => createElement(BusinessHolidayFormFields, { form, custom: true, repeatsYearly: false, timezone: "Europe/Helsinki" }),
  }))
  const closed = await renderFields(true)
  assert.doesNotMatch(closed, /data-slot="alert"/)
  assert.match(closed, /Alkupäivä/)
  assert.match(closed, /Loppupäivä/)
  assert.match(closed, /data-slot="toggle-group"/)
  assert.ok(closed.indexOf("Alkupäivä") < closed.indexOf('data-slot="toggle-group"'), "The status selector follows the date")
  assert.doesNotMatch(closed, /Avautuu|Sulkeutuu/)
  const open = await renderFields(false)
  assert.match(open, /Avautuu/)
  assert.match(open, /Sulkeutuu/)
  assert.doesNotMatch(open, /Tälle päivälle ei voi tehdä varauksia/)
  await i18n.changeLanguage("en")
  assert.match(await renderFields(false), /Open or closed/)
  console.info("PASS separate exception tab, no nested schedule form, date/status order, no closed alert, conditional time fields and Finnish/English labels")
} finally {
  queryClient.clear()
  await vite.close()
}
