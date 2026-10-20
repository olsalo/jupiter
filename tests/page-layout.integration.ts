import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"

import { resolvePageLayout } from "../app/lib/page-layout.ts"

assert.equal(resolvePageLayout("viewport", false), "viewport")
assert.equal(resolvePageLayout("viewport", true), "viewport")
assert.equal(resolvePageLayout("scroll", false), "scroll")
assert.equal(resolvePageLayout("scroll", true), "scroll")
assert.equal(resolvePageLayout("viewport-desktop", false), "viewport")
assert.equal(resolvePageLayout("viewport-desktop", true), "scroll")

const appPath = new URL("../app", import.meta.url).pathname
const i18n = createInstance()
await i18n.init({ lng: "en", resources: { en: { common: { loading: "Loading" } } }, interpolation: { escapeValue: false } })

for (const style of ["classic", "floating"]) {
  const vite = await createServer({
    configFile: false,
    appType: "custom",
    define: { "import.meta.env.VITE_APP_LAYOUT_STYLE": JSON.stringify(style) },
    resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/lib": `${appPath}/lib` } },
    server: { middlewareMode: true, ws: false, hmr: false, watch: null },
  })
  try {
    const { ViewportPage, ScrollPage } = await vite.ssrLoadModule("/app/components/page-layout.tsx") as typeof import("../app/components/page-layout")
    const { RouteHeader } = await vite.ssrLoadModule("/app/components/route-header.tsx") as typeof import("../app/components/route-header")
    const header = createElement(RouteHeader, {
      title: "Calendar",
      description: "Appointments",
      actions: createElement("button", { type: "button" }, "Add booking"),
      mobileControls: createElement("input", { "aria-label": "Choose date", readOnly: true, value: "2026-10-19" }),
    })
    for (const Layout of [ViewportPage, ScrollPage]) {
      const render = (loading: boolean) => renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(Layout, {
        header,
        children: loading
          ? createElement("div", { className: "flex min-h-0 flex-1 items-center justify-center", role: "status" }, "Loading")
          : createElement("div", null, "Appointments"),
      })))
      const loading = render(true)
      const loaded = render(false)
      const headerOf = (markup: string) => markup.match(/<header\b[\s\S]*?<\/header>/)?.[0]
      assert.equal((loaded.match(/<header\b/g) ?? []).length, 1, `${style} pages have one header`)
      assert.equal(headerOf(loading), headerOf(loaded), `${style} loading retains the complete header layout`)
      assert.match(headerOf(loading) ?? "", /aria-label="Choose date"/, "Mobile controls are present before hydration")
      assert.match(loading, /data-slot="page-content"[\s\S]*items-center justify-center/, "The loader is centered inside the content area")
      const content = loaded.match(/<div\b[^>]*data-slot="page-content"[^>]*>/)?.[0] ?? ""
      if (Layout === ViewportPage) {
        assert.match(loaded, /data-slot="viewport-page"/)
        assert.match(content, /h-0 min-h-0 overflow-hidden/, "Viewport content stays within the available height")
      } else {
        assert.match(loaded, /data-slot="scroll-page"/)
        assert.doesNotMatch(content, /overflow-hidden|h-0/, "Scroll content can grow beyond the viewport")
      }
    }
  } finally {
    await vite.close()
  }
}

console.info("PASS viewport and scroll layouts, responsive sizing, shared headers and stable loading in both app styles")
