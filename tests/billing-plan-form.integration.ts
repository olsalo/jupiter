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
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/billing-plan-form", appType: "custom", resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/components": `${appPath}/components/ui`, "@coss/ui/lib": `${appPath}/lib` } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
try {
  const { BillingPlanForm } = await vite.ssrLoadModule("/app/components/billing/billing-plan-form.tsx") as typeof import("../app/components/billing/billing-plan-form")
  const { TRPCProvider, trpc } = await vite.ssrLoadModule("/app/lib/trpc/client.tsx") as typeof import("../app/lib/trpc/client")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const { plans } = await vite.ssrLoadModule("/app/lib/billing/plans.ts") as typeof import("../app/lib/billing/plans")
  const options = createTRPCOptionsProxy({ client: trpc, queryClient })
  const state = { trialEligible: false, plans: [...plans], annualEnabled: true, billingEnabled: true, used: 5, current: { planId: "team" as const, interval: "month" as const, extraStaff: 2, capacity: 5 }, pending: null, paymentPending: false, paymentUrl: null }
  queryClient.setQueryData(options.billing.plan.queryKey(), state)
  const i18n = createInstance()
  await i18n.init({ resources, lng: "en", defaultNS: "common", interpolation: { escapeValue: false } })
  let onboarding = true
  const handler = createStaticHandler([{ id: "root", path: "/", loader: () => ({ formatPreference: "eu", organizationTimezone: "Europe/Helsinki" }), Component: () => createElement(BillingPlanForm, { onboarding }) }])
  const render = async () => {
    const context = await handler.query(new Request("https://example.invalid/"))
    assert.ok(!(context instanceof Response))
    const router = createStaticRouter(handler.dataRoutes, context)
    const routed = createElement(StaticRouterProvider, { router, context, hydrate: false })
    const provided = createElement(TRPCProvider, { trpcClient: trpc, queryClient, children: routed })
    return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(QueryClientProvider, { client: queryClient }, provided)))
  }
  const english = await render()
  assert.match(english, /Solo/)
  assert.match(english, /Team/)
  assert.match(english, /€110/)
  assert.match(english, /Bookable team members/)
  assert.match(english, /\/ month \+ VAT/)
  assert.match(english, /noValidate=""/i)
  assert.match(english, /name="bookablePeople"/)
  assert.match(english, /value="5"/)
  assert.match(english, /data-slot="number-field"/)
  assert.match(english, /data-slot="onboarding-actions"/)
  assert.match(english, /Billing cycle/)
  assert.doesNotMatch(english, /\bPro\b/)
  assert.match(english, /role="radiogroup"/)
  assert.doesNotMatch(english, /Activate demo subscription/)
  assert.match(english, /data-slot="radio-card"/)
  onboarding = false
  const settings = await render()
  assert.match(settings, /data-slot="radio-card"/)
  assert.match(settings, /€110/)
  assert.match(settings, /name="bookablePeople"/)
  assert.doesNotMatch(settings, /data-slot="onboarding-actions"/)
  onboarding = true
  await i18n.changeLanguage("fi")
  const finnish = await render()
  assert.match(finnish, /Valitse paketti/)
  assert.match(finnish, /Ajanvarattavat tiimiläiset/)
  assert.match(finnish, /\/ kk \+ alv/)
  queryClient.setQueryData(options.billing.plan.queryKey(), { ...state, paymentPending: true, paymentUrl: "https://invoice.stripe.test/pay" })
  const pending = await render()
  assert.match(pending, /Viimeistele maksu/)
  assert.match(pending, /https:\/\/invoice.stripe.test\/pay/)
  await i18n.changeLanguage("en")
  queryClient.setQueryData(options.billing.plan.queryKey(), { ...state, annualEnabled: false, current: { ...state.current, interval: "year" } })
  const monthlyOnly = await render()
  assert.doesNotMatch(monthlyOnly, /Billing cycle|Yearly|Two months free/)
  assert.match(monthlyOnly, /€110/)
  assert.match(monthlyOnly, /\/ month \+ VAT/)
  queryClient.setQueryData(options.billing.plan.queryKey(), { ...state, annualEnabled: false, current: null, trialEligible: true })
  const newTeam = await render()
  assert.match(newTeam, /value="5"/, "The suggested plan fits all existing bookable people")
  assert.match(newTeam, /€110/, "The displayed price includes the required additional people")
  assert.doesNotMatch(newTeam, /role="alert"/)
  assert.match(newTeam, /14 days free/)
  assert.match(newTeam, /No charge today/)
  assert.match(newTeam, /Cancel anytime/)
  assert.ok(newTeam.indexOf("No charge today") > newTeam.indexOf("Continue to checkout"))
  queryClient.setQueryData(options.billing.plan.queryKey(), { ...state, current: null, trialEligible: false })
  const returningBusiness = await render()
  assert.doesNotMatch(returningBusiness, /No charge today|14 days free/)
  assert.match(returningBusiness, /Cancel anytime/)
  console.info("PASS billing form server rendering, price totals, Finnish labels, RVF inputs and pending-payment recovery")
} finally {
  queryClient.clear()
  await vite.close()
}
