import "dotenv/config"
import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createMemoryRouter, Outlet, RouterProvider } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"

const appPath = new URL("../app", import.meta.url).pathname

for (const style of ["classic", "floating"]) {
  const vite = await createServer({
    configFile: false, cacheDir: `node_modules/.vite-tests/workspace-layout-${style}`, appType: "custom",
    define: { "import.meta.env.APP_LAYOUT_STYLE": JSON.stringify(style) },
    resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/components": `${appPath}/components/ui`, "@coss/ui/lib": `${appPath}/lib` } },
    server: { middlewareMode: true, ws: false, hmr: false, watch: null },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
  try {
    const { default: Layout } = await vite.ssrLoadModule("/app/routes/layout.tsx") as typeof import("../app/routes/layout")
    const { TRPCProvider, trpc } = await vite.ssrLoadModule("/app/lib/trpc/client.tsx") as typeof import("../app/lib/trpc/client")
    const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
    const { useMediaQuery } = await vite.ssrLoadModule("/app/lib/hooks.ts") as typeof import("../app/lib/hooks")
    const i18n = createInstance()
    await i18n.init({ resources, lng: "en", defaultNS: "common", interpolation: { escapeValue: false } })
    function MediaQueryDefaults() {
      const defaultMatch = useMediaQuery("min-768px")
      const desktopMatch = useMediaQuery("min-768px", { serverMatches: true })
      return createElement("div", { "data-default": defaultMatch, "data-desktop": desktopMatch })
    }
    assert.match(renderToStaticMarkup(createElement(MediaQueryDefaults)), /data-default="false" data-desktop="true"/, "Media queries retain configurable, browser-independent server snapshots")

    for (const isElectron of [false, true]) {
      for (const role of ["owner", "member"]) {
        for (const pageLayout of ["scroll", "viewport", "viewport-desktop"]) {
          const root = { isElectron, user: { id: "user", name: "Aino" } }
          const workspace = { org: { id: "business", name: "Business" }, organizations: [{ id: "business", name: "Business", role }] }
          const router = createMemoryRouter([{
            id: "root", path: "/", Component: Outlet,
            children: [{ id: "routes/layout", Component: Layout, children: [{
              id: "calendar", path: "calendar", handle: { workspace: true, pageLayout },
              Component: () => createElement("div", { "data-slot": "layout-test-content" }, "Calendar content"),
            }] }],
          }], { initialEntries: ["/calendar"], hydrationData: { loaderData: { root, "routes/layout": workspace } } })
          try {
            const markup = renderToStaticMarkup(createElement(I18nextProvider, { i18n },
              createElement(QueryClientProvider, { client: queryClient },
                createElement(TRPCProvider, { trpcClient: trpc, queryClient, children: createElement(RouterProvider, { router }) }))))
            assert.match(markup, new RegExp(`${style}-layout`))
            assert.match(markup, new RegExp(`data-page-layout="${pageLayout}"`), "CSS receives the route's scroll layout")
            assert.equal((markup.match(/data-slot="page-bottom-fade"/g) ?? []).length, 1, "Both layouts use one shared bottom fade")
            assert.match(markup, new RegExp(`data-electron="${isElectron}"`), "Electron comes from root loader data on the first render")
            assert.equal(markup.includes("electron-drag "), isElectron, "Only Electron gets a window drag region")
            assert.match(markup, /data-slot="layout-test-content"/, "Both layout styles render the nested route")
            assert.match(markup, /href="\/calendar"/, "Calendar navigation remains available")
            assert.equal(markup.includes('href="/team"'), role === "owner", "Navigation respects team permissions")
            assert.match(markup, pageLayout === "scroll" ? /app-page-scroll(?![^"]*!overflow-y-hidden)/ : /app-page-scroll[^"]*!overflow-y-hidden/, "Viewport pages and scroll pages keep their scroll behavior")
            assert.doesNotMatch(markup, /route-enter/, "The initial server render does not animate the page")
          } finally {
            router.dispose()
          }
        }
      }
    }
  } finally {
    queryClient.clear()
    await vite.close()
  }
}
console.info("PASS both workspace layouts, Electron server state, role permissions, nested routes, scrolling and media query defaults")
