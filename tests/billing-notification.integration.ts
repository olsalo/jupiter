import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/billing-notification", appType: "custom", resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/lib": `${appPath}/lib` } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
try {
  const { BillingNotificationBar } = await vite.ssrLoadModule("/app/components/billing/billing-notification-bar.tsx") as typeof import("../app/components/billing/billing-notification-bar")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const i18n = createInstance()
  await i18n.init({ resources, lng: "fi", defaultNS: "common", interpolation: { escapeValue: false } })
  for (const role of ["owner", "admin", "member"]) {
    const handler = createStaticHandler([{ id: "root", path: "/", loader: () => ({ org: { id: "org" }, organizations: [{ id: "org", role }] }), Component: () => createElement(BillingNotificationBar, { notification: { type: "subscription-inactive" } }) }])
    const context = await handler.query(new Request("https://example.invalid/"))
    assert.ok(!(context instanceof Response))
    const router = createStaticRouter(handler.dataRoutes, context)
    const markup = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(StaticRouterProvider, { router, context, hydrate: false })))
    assert.match(markup, /Tilaus ei ole aktiivinen/)
    assert.match(markup, /Ajanvarauksia, asiakkaita ja palveluita voi vain tarkastella/)
    assert.equal(markup.includes("Avaa laskutus"), role === "owner", "Only owners can open billing")
  }
  assert.doesNotMatch(i18n.t("settings.billingNotActiveDescription"), /maksullisia ominaisuuksia/)
  console.info("PASS inactive subscription alert is visible to all roles, with billing access for owners")
} finally {
  await vite.close()
}
