import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/booking-customer-details",
  appType: "custom",
  resolve: { alias: { "~": appPath, "@coss/ui/lib": `${appPath}/lib` } },
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})
try {
  const { BookingCustomerDetails } = await vite.ssrLoadModule("/app/components/calendar/booking-customer-details.tsx") as typeof import("../app/components/calendar/booking-customer-details")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const i18n = createInstance()
  await i18n.init({ lng: "en", resources, defaultNS: "common", interpolation: { escapeValue: false } })
  const render = (answers: Parameters<typeof BookingCustomerDetails>[0]["answers"]) => renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(BookingCustomerDetails, { answers })))
  assert.equal(render([]), "")
  for (const language of ["en", "fi"]) {
    await i18n.changeLanguage(language)
    const html = render([
      { id: "second", value: false, question: { label: "First visit", sortOrder: 2 } },
      { id: "first", value: 0, question: { label: "Previous visits", sortOrder: 1 } },
      { id: "third", value: ["A", "B"], question: { label: "Preferences", sortOrder: 3 } },
      { id: "fourth", value: "Ääkköset <script>alert(1)</script>", question: { label: "Extra details", sortOrder: 4 } },
    ])
    assert.ok(html.includes(i18n.t("bookingForm.customerDetails")))
    assert.ok(html.includes(language === "fi" ? "Ei" : "No"))
    assert.ok(html.includes(">0</dd>"))
    assert.ok(html.includes("A, B"))
    assert.ok(html.indexOf("Previous visits") < html.indexOf("First visit"))
    assert.ok(html.includes("&lt;script&gt;"))
    assert.ok(!html.includes("<script>"))
  }
  console.info("PASS ordered intake answers render safely in English and Finnish, including false and zero")
} finally {
  await vite.close()
}
