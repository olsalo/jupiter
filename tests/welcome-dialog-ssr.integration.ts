import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"

const vite = await createServer({
  configFile: false,
  appType: "custom",
  resolve: { alias: {
    "@coss/ui/components": new URL("../app/components/ui", import.meta.url).pathname,
    "@coss/ui/lib": new URL("../app/lib", import.meta.url).pathname,
    "@": new URL("../app", import.meta.url).pathname,
    "~": new URL("../app", import.meta.url).pathname,
  } },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
})

try {
  const { WelcomeDialog } = await vite.ssrLoadModule("/app/components/welcome-dialog.tsx") as typeof import("../app/components/welcome-dialog")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const i18n = createInstance()
  await i18n.init({ lng: "en", resources, defaultNS: "common", interpolation: { escapeValue: false } })
  const routes = [{ path: "/", Component: WelcomeDialog }]
  const handler = createStaticHandler(routes)

  for (const language of ["en", "fi"]) {
    await i18n.changeLanguage(language)
    for (const search of ["", "?welcome=false", "?welcome=true", "?tab=forms&welcome=true"]) {
      const context = await handler.query(new Request(`http://localhost/${search}`))
      assert.ok(!(context instanceof Response))
      const router = createStaticRouter(routes, context)
      const html = renderToStaticMarkup(createElement(I18nextProvider, {
        i18n,
        children: createElement(StaticRouterProvider, { context, router, hydrate: false }),
      }))
      const open = new URLSearchParams(search).get("welcome") === "true"
      assert.equal(html.includes('role="dialog"'), open)
      if (!open) {
        assert.equal(html.includes(i18n.t("welcome.title")), false)
        continue
      }

      assert.equal(html.match(/role="dialog"/g)?.length, 1)
      assert.ok(html.includes('aria-modal="true"'))
      for (const key of ["title", "description", "start", "notes.title", "overview.title", "team.title"]) {
        assert.ok(html.includes(i18n.t(`welcome.${key}`)))
      }
      for (const attribute of ["aria-labelledby", "aria-describedby"]) {
        const id = html.match(new RegExp(`${attribute}="([^"]+)"`))?.[1]
        assert.ok(id && html.includes(`id="${id}"`))
      }
      for (const slot of ["dialog-backdrop", "dialog-viewport", "dialog-popup"]) {
        const element = html.match(new RegExp(`<div[^>]*data-slot="${slot}"[^>]*>`))?.[0]
        assert.ok(element)
        assert.equal(/\shidden(?:=|\s|>)/.test(element), false, `${slot} must be visible before hydration`)
      }
      assert.ok(html.includes("/mockup.png"))
    }
  }
  console.info("PASS welcome query parameter renders one accessible server dialog in English and Finnish, with visible backdrop and content")
} finally {
  await vite.close()
}
