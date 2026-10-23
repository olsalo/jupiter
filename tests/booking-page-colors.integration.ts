import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"

const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/booking-page-colors",
  appType: "custom",
  resolve: { alias: {
    "~": new URL("../app", import.meta.url).pathname,
    "@": new URL("../app", import.meta.url).pathname,
    "@coss/ui/lib": new URL("../app/lib", import.meta.url).pathname,
  } },
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})

try {
  const { AccentColorSelect } = await vite.ssrLoadModule("/app/components/accent-color-select.tsx") as typeof import("../app/components/accent-color-select")
  const { bookingPageAccentColors, bookingPageColorStyle } = await vite.ssrLoadModule("/app/lib/booking-page-colors.ts") as typeof import("../app/lib/booking-page-colors")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const i18n = createInstance()
  await i18n.init({ lng: "en", resources, defaultNS: "common", interpolation: { escapeValue: false } })
  for (const language of ["en", "fi"]) {
    await i18n.changeLanguage(language)
    for (const color of [null, ...bookingPageAccentColors.map((item) => item.color), "#aabbcc"]) {
      const html = renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(AccentColorSelect, {
        value: color, name: "accentColor", disabled: false, invalid: false,
        label: i18n.t("adminBookingPage.accentColor"), onChange: () => undefined,
      })))
      assert.ok(html.includes('role="combobox"'))
      assert.ok(html.includes('name="accentColor"'))
      assert.ok(html.includes(color ? `background-color:${color}` : language === "fi" ? "Karhunvatukka" : "Blackberry"))
    }
  }
  assert.equal(bookingPageColorStyle(null), undefined)
  for (const color of [...bookingPageAccentColors.map((item) => item.color), "#ffffff", "#888888", "#aabbcc", "#000000"]) {
    const style = bookingPageColorStyle(color) as Record<string, string>
    assert.equal(style["--primary"], color)
    assert.equal(style["--ring"], color)
    const luminance = (hex: string) => {
      const [red, green, blue] = [1, 3, 5].map((offset) => {
        const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
      return red * 0.2126 + green * 0.7152 + blue * 0.0722
    }
    const background = luminance(color)
    const foreground = luminance(style["--primary-foreground"])
    assert.ok((Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05) >= 4.5)
  }
  console.info("PASS booking page color dropdown in English and Finnish, defaults, custom colors, and readable public button colors")
} finally {
  await vite.close()
}
