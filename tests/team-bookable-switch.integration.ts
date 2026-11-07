import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/team-bookable-switch", appType: "custom", resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/lib": `${appPath}/lib` } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
try {
  const { TeamBookableSwitch } = await vite.ssrLoadModule("/app/components/team/team-bookable-switch.tsx") as typeof import("../app/components/team/team-bookable-switch")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const i18n = createInstance()
  await i18n.init({ resources, lng: "fi", defaultNS: "team", interpolation: { escapeValue: false } })
  for (const checked of [true, false]) {
    const render = (subscriptionInactive: boolean) => renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(TeamBookableSwitch, { checked, label: "Vastaanottaa varauksia", description: "Lisää palvelut ja työajat", subscriptionInactive, onCheckedChange: () => {} })))
    const inactive = render(true)
    const inactiveSwitch = inactive.match(/<span\b[^>]*role="switch"[^>]*>/)?.[0] ?? ""
    assert.match(inactiveSwitch, /aria-disabled="true"/)
    assert.match(inactiveSwitch, new RegExp(`aria-checked="${checked}"`), "The saved setting is preserved")
    assert.match(inactive, /Asetuksen muuttamiseen tarvitaan aktiivinen tilaus/)
    assert.match(inactive, /class="opacity-64">Vastaanottaa varauksia/)
    assert.match(inactive, /class="opacity-64">Lisää palvelut ja työajat/)
    const settings = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(TeamBookableSwitch, { checked, label: "Vastaanottaa varauksia", description: "Lisää palvelut ja työajat", subscriptionInactive: true, dimLabels: false, onCheckedChange: () => {} })))
    assert.doesNotMatch(settings, /class="opacity-64"/)
    assert.match(settings, /aria-disabled="true"/)
    assert.match(settings, /Asetuksen muuttamiseen tarvitaan aktiivinen tilaus/)
    assert.doesNotMatch(inactive, /border-info\/32/)
    const active = render(false)
    assert.doesNotMatch(active, /aria-disabled="true"|Asetuksen muuttamiseen tarvitaan aktiivinen tilaus|class="opacity-64"/)
  }
  console.info("PASS inactive subscriptions disable the appointment switch while preserving its value")
} finally {
  await vite.close()
}
