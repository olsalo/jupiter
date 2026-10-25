import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({ configFile: false, appType: "custom", resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/components": `${appPath}/components/ui`, "@coss/ui/lib": `${appPath}/lib` } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
try {
  const { getVisibleSettingsItems, getSettingsItemIdFromHash, getSafeSettingsHash } = await vite.ssrLoadModule("/app/lib/routing/settings-navigation.ts") as typeof import("../app/lib/routing/settings-navigation")
  assert.deepEqual(getVisibleSettingsItems("member").map((item) => item.id), ["profile"])
  assert.deepEqual(getVisibleSettingsItems("admin").map((item) => item.id), ["profile", "business", "locations", "booking", "communications"])
  assert.deepEqual(getVisibleSettingsItems("owner").map((item) => item.id), ["profile", "business", "locations", "booking", "communications", "billing"])
  assert.equal(getSettingsItemIdFromHash("#settings/locations", "owner"), "locations")
  assert.equal(getSettingsItemIdFromHash("#settings/locations/", "owner"), "locations")
  assert.equal(getSettingsItemIdFromHash("#settings/locations", "member"), "profile")
  assert.equal(getSettingsItemIdFromHash("#settings/billing", "admin"), "profile")
  assert.equal(getSettingsItemIdFromHash("#settings/general", "admin"), "business")
  assert.equal(getSettingsItemIdFromHash("#settings/notifications", "admin"), "communications")
  assert.equal(getSettingsItemIdFromHash("#settings/appearance", "member"), "profile")
  assert.equal(getSettingsItemIdFromHash("#settings/unknown", "owner"), "profile")
  assert.equal(getSettingsItemIdFromHash("#settings", "owner"), "profile")
  assert.equal(getSettingsItemIdFromHash("#calendar", "owner"), null)
  assert.equal(getSettingsItemIdFromHash("", "owner"), null)
  for (const item of getVisibleSettingsItems("owner")) {
    assert.equal(getSafeSettingsHash(`#settings/${item.id}`), `#settings/${item.id}`)
  }
  for (const hash of ["https://example.invalid", "#settings/unknown", "#settings/profile?next=evil", "#settings/profile/extra"]) {
    assert.equal(getSafeSettingsHash(hash), "")
  }
  const { RouteInformationArchitecture } = await vite.ssrLoadModule("/app/components/information-architecture/route-information-architecture.tsx") as typeof import("../app/components/information-architecture/route-information-architecture")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const i18n = createInstance()
  await i18n.init({ resources, lng: "en", defaultNS: "common", interpolation: { escapeValue: false } })
  for (const section of ["locations", "booking", "communications"] as const) {
    const markup = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(RouteInformationArchitecture, { section, icon: "settings" })))
    assert.match(markup, /data-slot="route-information-architecture"/)
    assert.match(markup, /Information architecture/)
    assert.doesNotMatch(markup, /<form|type="submit"|settings\./)
  }
  await i18n.changeLanguage("fi")
  const finnish = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(RouteInformationArchitecture, { section: "communications", icon: "mail" })))
  assert.match(finnish, /Ajanvarausviestit/)
  assert.match(finnish, /Tietorakenne/)
  console.info("PASS role-based settings sections, hash links and aliases, restricted deep links, safe preference redirects, IA previews and Finnish labels")
} finally {
  await vite.close()
}
