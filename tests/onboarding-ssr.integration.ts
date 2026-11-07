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
  const { default: Onboarding } = await vite.ssrLoadModule("/app/routes/onboarding/onboarding.tsx") as typeof import("../app/routes/onboarding/onboarding")
  const { default: Business } = await vite.ssrLoadModule("/app/routes/onboarding/business.tsx") as typeof import("../app/routes/onboarding/business")
  const { default: Location } = await vite.ssrLoadModule("/app/routes/onboarding/location.tsx") as typeof import("../app/routes/onboarding/location")
  const { default: Availability } = await vite.ssrLoadModule("/app/routes/onboarding/availability.tsx") as typeof import("../app/routes/onboarding/availability")
  const { default: Holidays } = await vite.ssrLoadModule("/app/routes/onboarding/holidays.tsx") as typeof import("../app/routes/onboarding/holidays")
  const { TRPCProvider, trpc } = await vite.ssrLoadModule("/app/lib/trpc/client.tsx") as typeof import("../app/lib/trpc/client")
  const { defaultBusinessHolidays } = await vite.ssrLoadModule("/app/lib/business/business-holidays.server.ts") as typeof import("../app/lib/business/business-holidays.server")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const { onboardingFormSchema, onboardingLocationSchema } = await vite.ssrLoadModule("/app/lib/schemas/onboarding.ts") as typeof import("../app/lib/schemas/onboarding")
  const { configureZodI18n } = await vite.ssrLoadModule("/app/lib/validation/zod.ts") as typeof import("../app/lib/validation/zod")
  const options = createTRPCOptionsProxy({ client: trpc, queryClient })
  queryClient.setQueryData(options.onboarding.business.queryKey(), {
    businessName: "Yritys Oy",
    currency: "EUR",
    location: "fi",
    name: "Matti Meikäläinen",
    timezone: "Europe/Helsinki",
  })
  queryClient.setQueryData(options.onboarding.location.queryKey(), { id: null, name: "Yritys Oy", addressLine1: "", addressLine2: "", postalCode: "", city: "", country: "FI", phone: "", email: "" })
  queryClient.setQueryData(options.onboarding.schedule.queryKey(), {
    countryCode: "FI",
    timezone: "Europe/Helsinki",
    workingHours: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startMinute: 540, endMinute: 1020, timezone: "Europe/Helsinki", isActive: true, validFrom: null, validUntil: null })),
    breaks: [],
    holidays: defaultBusinessHolidays(2027),
  })
  const i18n = createInstance()
  await i18n.init({ resources, lng: "en", defaultNS: "common", interpolation: { escapeValue: false } })
  let loaderLocale = "en"
  let currentStepId: "business" | "location" | "availability" | "holidays" | "subscription" = "business"
  const handler = createStaticHandler([{ id: "root", path: "/", Component: Outlet, loader: () => ({ locale: loaderLocale, formatPreference: "eu" }), children: [{ path: "onboarding", Component: () => createElement(Onboarding, { loaderData: { nextStep: "subscription", stepId: currentStepId, step: 2, totalSteps: 5 } } as Parameters<typeof Onboarding>[0]), children: [{ path: "business", Component: Business }, { path: "location", Component: Location }, { path: "availability", Component: Availability }, { path: "holidays", Component: Holidays }, { path: "subscription", Component: () => null }] }] }])
  const render = async (step: typeof currentStepId) => {
    currentStepId = step
    const context = await handler.query(new Request(`https://example.invalid/onboarding/${step}`))
    assert.ok(!(context instanceof Response))
    const router = createStaticRouter(handler.dataRoutes, context)
    const routed = createElement(StaticRouterProvider, { router, context, hydrate: false })
    const provided = createElement(TRPCProvider, { trpcClient: trpc, queryClient, children: routed })
    return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(QueryClientProvider, { client: queryClient }, provided)))
  }
  const business = await render("business")
  assert.match(business, /<title>Business details<\/title>/)
  assert.match(business, /Yritys Oy/)
  assert.match(business, /Europe\/Helsinki/)
  assert.doesNotMatch(business, /data-slot="skeleton"/)
  queryClient.setQueryData(options.onboarding.business.queryKey(), {
    businessName: "",
    currency: "",
    location: "",
    name: "Anna Korhonen",
    timezone: "",
  })
  const unselectedBusiness = await render("business")
  assert.match(unselectedBusiness, /Choose a country/)
  assert.match(unselectedBusiness, /Choose a currency/)
  assert.match(unselectedBusiness, /Choose a time zone/)
  assert.doesNotMatch(unselectedBusiness, />Finland</)
  assert.doesNotMatch(unselectedBusiness, />Europe\/Helsinki</)
  const location = await render("location")
  assert.match(location, /<title>Location details<\/title>/)
  assert.match(location, /Location details/)
  for (const placeholder of ["Studio Helmi", "12 Main Street", "Suite 2", "00100", "Helsinki", "40 123 4567", "hello@studiohelmi.com"]) assert.ok(location.includes(`placeholder="${placeholder}"`), placeholder)
  assert.match(location, /name="phoneDialCode"/)
  assert.match(location, /\+358/)
  const validLocation = { id: null, name: "Studio Helmi", addressLine1: "Katu 1", addressLine2: "", postalCode: "00100", city: "Helsinki", country: "FI", phone: "", email: "" }
  assert.equal(onboardingLocationSchema.safeParse(validLocation).success, true)
  assert.equal(onboardingLocationSchema.parse({ ...validLocation, phone: "+358 40 123 4567", country: "fi" }).phone, "+358401234567")
  assert.equal(onboardingLocationSchema.safeParse({ ...validLocation, phone: "invalid" }).success, false)
  assert.equal(onboardingLocationSchema.safeParse({ ...validLocation, country: "JP" }).success, false)
  assert.match(location, /Yritys Oy/)
  for (const label of ["Location name", "Street address", "Postal code", "City", "Country", "Phone (optional)", "Email (optional)"]) assert.ok(location.includes(label), label)
  assert.match(location, /noValidate=""/i)
  assert.doesNotMatch(location, /Choose a time zone/)
  const hours = await render("availability")
  assert.match(hours, /<title>Opening hours<\/title>/)
  assert.match(hours, /Set your usual hours/)
  assert.match(hours, /data-slot="working-hours-week"/)
  assert.equal((hours.match(/name="workingHours\[\d+\]\.startMinute"/g) ?? []).length, 5)
  assert.match(hours, /noValidate=""/i)
  assert.doesNotMatch(hours, /Reset to business working hours/)
  const holidays = await render("holidays")
  assert.match(holidays, /<title>Holiday hours<\/title>/)
  assert.match(await render("subscription"), /<title>Choose your plan<\/title>/)
  assert.match(holidays, /Review your holiday hours/)
  assert.match(holidays, /Christmas Day/)
  assert.match(holidays, /Review the suggested closures/)
  assert.match(holidays, /Add holiday/)
  assert.match(holidays, /Continue/)
  queryClient.setQueryData(options.onboarding.schedule.queryKey(), (current) => current ? {
    ...current,
    countryCode: "US",
    holidays: defaultBusinessHolidays(2027, "us"),
  } : current)
  const americanHolidays = await render("holidays")
  assert.match(americanHolidays, /Review the suggested closures/)
  assert.match(americanHolidays, /Thanksgiving Day/)
  assert.match(americanHolidays, /Friday 1\.1\.2027/)
  assert.doesNotMatch(americanHolidays, /Midsummer/)
  await i18n.changeLanguage("fi")
  assert.match(await render("location"), /<title>Toimipaikan tiedot<\/title>/)
  assert.match(await render("location"), /Toimipaikan tiedot/)
  assert.match(await render("location"), /Puhelin \(valinnainen\)/)
  assert.match(await render("availability"), /Määritä aukioloajat/)
  const finnishHolidays = await render("holidays")
  assert.match(finnishHolidays, /Tarkista vapaapäivät/)
  assert.match(finnishHolidays, /perjantai 1\.1\.2027/, "Weekday names change immediately while the route loader still has English")
  assert.doesNotMatch(finnishHolidays, /Friday 1\.1\.2027/)
  loaderLocale = "fi"
  await i18n.changeLanguage("en")
  assert.match(await render("holidays"), /Friday 1\.1\.2027/, "Switching back also updates weekday names before loader revalidation")
  for (const [language, message] of [["en", "Required"], ["fi", "Pakollinen"]]) {
    await i18n.changeLanguage(language)
    configureZodI18n(i18n.t.bind(i18n))
    for (const empty of ["", "   "]) {
      const result = onboardingFormSchema.safeParse({ businessName: empty, name: empty, currency: empty, location: empty, timezone: empty })
      assert.equal(result.success, false)
      if (!result.success) {
        assert.equal(result.error.issues.length, 5)
        for (const issue of result.error.issues) assert.equal(issue.message, message)
      }
    }
  }
  console.info("PASS onboarding availability and holiday route rendering, weekly editor, RVF forms and English/Finnish labels")
} finally {
  queryClient.clear()
  await vite.close()
}
