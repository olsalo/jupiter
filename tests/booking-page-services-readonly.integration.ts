import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/booking-page-services-readonly", appType: "custom", resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/lib": `${appPath}/lib` } }, server: { middlewareMode: true, hmr: false, ws: false, watch: null } })
try {
  const { BookingPageServices } = await vite.ssrLoadModule("/app/components/booking-page/booking-page-services.tsx") as typeof import("../app/components/booking-page/booking-page-services")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const i18n = createInstance()
  await i18n.init({ resources, lng: "fi", defaultNS: "common", interpolation: { escapeValue: false } })
  const render = (disabled: boolean) => renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(BookingPageServices, {
    label: "Varaussivun palvelut", description: "Valitse palvelut", items: [{ id: "a", name: "Leikkaus" }, { id: "b", name: "Värjäys" }], value: ["a", "b"], hiddenServiceIds: [], onChange: () => {}, onHiddenServiceIdsChange: () => {}, onBlur: () => {}, inputRef: null, disabled,
  })))
  const disabled = render(true)
  const enabled = render(false)
  assert.match(disabled, /aria-disabled="true"[^>]*aria-invalid="false"[^>]*aria-label="Varaussivun palvelut"/)
  assert.match(disabled.match(/<label\b[^>]*data-slot="field-label"[^>]*>/)?.[0] ?? "", /opacity-64/)
  assert.match(disabled.match(/<p\b[^>]*data-slot="field-description"[^>]*>/)?.[0] ?? "", /opacity-64/)
  for (const label of ["Siirrä palvelua Leikkaus", "Piilota Leikkaus varaussivulta"]) {
    const findButton = (html: string) => html.match(/<button\b[^>]*>/g)?.find((button) => button.includes(`aria-label="${label}"`)) ?? ""
    assert.match(findButton(disabled), /disabled=""/)
    assert.doesNotMatch(findButton(enabled), /disabled=""/)
  }
  assert.match(disabled, /opacity-64">Leikkaus/)
  assert.doesNotMatch(enabled, /opacity-64">Leikkaus/)
  console.info("PASS booking page services show their disabled state and retain their values")
} finally {
  await vite.close()
}
