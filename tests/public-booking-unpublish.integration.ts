import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/public-booking-unpublish",
  appType: "custom",
  resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/lib": `${appPath}/lib` } },
  plugins: [{
    name: "unpublished-booking-fixture",
    transform(code, id) {
      const emptyComponents: Record<string, string> = {
        "/components/settings/preferences/language-switch.tsx": "LanguageSwitch",
        "/components/settings/preferences/format-preference-switch.tsx": "FormatPreferenceSwitch",
        "/components/public-booking/public-booking-favicon.tsx": "PublicBookingFavicon",
      }
      const component = emptyComponents[id.replace(appPath, "")]
      if (component) return `export const ${component} = () => null`
      if (id === `${appPath}/components/public-booking/public-booking-profile.tsx`) {
        return 'export const PublicBookingProfile = () => "Active booking page"'
      }
      if (id !== `${appPath}/components/public-booking/public-booking-page.tsx`) return
      return code
        .replace('import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"', `
          export const fixture = { page: null }
          const useQuery = () => fixture.page
          const useQueryClient = () => ({})
          const useMutation = () => ({})
        `)
        .replace('const trpc = useTRPC()', 'const trpc = { booking: { getPage: { queryOptions: () => ({}) } } }')
        .replace('const formatPreference = useFormatPreference()', 'const formatPreference = { value: "eu", set: () => {} }')
    },
  }],
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})

try {
  const { PublicBookingPage, fixture } = await vite.ssrLoadModule("/app/components/public-booking/public-booking-page.tsx")
  const i18n = createInstance()
  await i18n.init({
    lng: "fi", defaultNS: "booking", interpolation: { escapeValue: false },
    resources: {
      fi: { booking: JSON.parse(await readFile(new URL("../app/locales/fi/booking.json", import.meta.url), "utf8")) },
      en: { booking: JSON.parse(await readFile(new URL("../app/locales/en/booking.json", import.meta.url), "utf8")) },
    },
  })
  const cachedData = { organization: { name: "Test business", slug: "test" }, page: null, services: [], settings: {} }
  const render = () => renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(PublicBookingPage, { organizationSlug: "test" })))
  fixture.page = { data: cachedData, isError: false, isPending: false, isRefetching: false }
  assert.match(render(), /Active booking page/)
  fixture.page = { ...fixture.page, isError: true, error: { data: { code: "NOT_FOUND" } } }
  const disabled = render()
  assert.match(disabled, /Varaussivua ei löytynyt/)
  assert.match(disabled, /<title>Varaussivua ei löytynyt<\/title>/)
  assert.match(disabled, /Tarkista linkki tai ota yhteyttä yritykseen/)
  assert.doesNotMatch(disabled, /Active booking page|Test business/)
  await i18n.changeLanguage("en")
  assert.match(render(), /<title>Booking page not found<\/title>/)
  await i18n.changeLanguage("fi")
  fixture.page.error.data.code = "INTERNAL_SERVER_ERROR"
  assert.match(render(), /Active booking page/, "Temporary refresh failures retain the available booking page")
  fixture.page.error.data = { code: "FORBIDDEN", appCode: "SUBSCRIPTION_INACTIVE" }
  const inactive = render()
  assert.match(inactive, /Ajanvaraus ei ole saatavilla/)
  assert.doesNotMatch(inactive, /Yritä uudelleen|Active booking page/, "Inactive subscriptions show no retry action or cached booking page")
  fixture.page.error.data = { code: "INTERNAL_SERVER_ERROR" }
  fixture.page.data = undefined
  assert.match(render(), /Yritä uudelleen/, "Unexpected failures still offer a retry")
  fixture.page.data = cachedData
  fixture.page = { ...fixture.page, isError: false, error: null }
  assert.match(render(), /Active booking page/, "Publishing the page again restores the booking view")
  assert.match(render(), /<title>Vapaat ajat · Test business<\/title>/, "Publishing restores the normal browser title")
  console.info("PASS unpublished pages show not-found despite cached booking data, recover when published, and retain data for temporary failures")
} finally {
  await vite.close()
}
