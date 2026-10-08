import "dotenv/config"
import assert from "node:assert/strict"
import { createElement, Fragment, type ContextType } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createStaticHandler, createStaticRouter, Meta, Outlet, StaticRouterProvider, UNSAFE_FrameworkContext } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"
import { queryCacheOptions } from "../app/lib/query-cache.ts"

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
const queryClient = new QueryClient({ defaultOptions: { queries: queryCacheOptions } })

try {
  const { default: NoteModal, meta: noteMeta } = await vite.ssrLoadModule("/app/routes/example/note-modal.tsx") as typeof import("../app/routes/example/note-modal")
  const { meta: notesMeta } = await vite.ssrLoadModule("/app/routes/example/example.tsx") as typeof import("../app/routes/example/example")
  const { default: NoteView } = await vite.ssrLoadModule("/app/routes/example/note-view.tsx") as typeof import("../app/routes/example/note-view")
  const { default: NoteEdit, meta: editMeta, loader: editLoader, clientLoader: editClientLoader } = await vite.ssrLoadModule("/app/routes/example/note-edit.tsx") as typeof import("../app/routes/example/note-edit")
  const { default: NewNoteModal, meta: newMeta } = await vite.ssrLoadModule("/app/routes/example/new-note-modal.tsx") as typeof import("../app/routes/example/new-note-modal")
  const { TRPCProvider, trpc } = await vite.ssrLoadModule("/app/lib/trpc/client.tsx") as typeof import("../app/lib/trpc/client")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const options = createTRPCOptionsProxy({ client: trpc, queryClient })
  queryClient.setQueryData(options.example.get.queryKey({ id: "note-ssr" }), {
    id: "note-ssr",
    title: "Server rendered note",
    body: "Notes available before hydration",
    organizationId: "organization-ssr",
    createdAt: new Date("2026-10-07T09:00:00Z"),
    updatedAt: new Date("2026-10-07T10:00:00Z"),
  })

  const i18n = createInstance()
  await i18n.init({ lng: "en", resources, defaultNS: "notes", interpolation: { escapeValue: false } })
  let renderSheet = true
  const Root = () => createElement(Fragment, null, createElement(Meta), createElement(Outlet))
  const frameworkContext = {
    future: {},
    ssr: true,
    isSpaMode: false,
    routeDiscovery: { mode: "initial" },
    manifest: { entry: { module: "", imports: [] }, routes: {}, url: "", version: "test" },
    routeModules: {
      root: { default: Root },
      "routes/example/example": { default: Outlet, meta: notesMeta },
      "routes/example/note-modal": { default: NoteModal, meta: noteMeta },
      "routes/example/note-view": { default: NoteView },
      "routes/example/note-edit": { default: NoteEdit, meta: editMeta },
      "routes/example/new-note-modal": { default: NewNoteModal, meta: newMeta },
    },
  } as unknown as NonNullable<ContextType<typeof UNSAFE_FrameworkContext>>
  const routes = [{
    id: "root",
    path: "/",
    loader: () => ({ locale: i18n.language }),
    Component: Root,
    children: [{
      id: "routes/example/example",
      path: "example",
      Component: Outlet,
      children: [
        { id: "routes/example/new-note-modal", path: "new", Component: () => renderSheet ? createElement(NewNoteModal) : null },
        {
          id: "routes/example/note-modal",
          path: ":noteId",
          loader: () => ({ title: "Server rendered note" }),
          Component: () => renderSheet ? createElement(NoteModal, {
            params: { noteId: "note-ssr" },
          } as Parameters<typeof NoteModal>[0]) : null,
          children: [{
            id: "routes/example/note-view",
            index: true,
            Component: NoteView,
          }, {
            id: "routes/example/note-edit",
            path: "edit",
            loader: editLoader,
            Component: () => createElement(NoteEdit, {
              params: { noteId: "note-ssr" },
            } as Parameters<typeof NoteEdit>[0]),
          }],
        },
      ],
    }],
  }]
  const handler = createStaticHandler(routes)
  assert.equal(editClientLoader(), null)

  for (const language of ["en", "fi"] as const) {
    await i18n.changeLanguage(language)
    for (const showSheet of [true, false]) {
      renderSheet = showSheet
      for (const mode of ["list", "create", "view", "edit"]) {
        const path = mode === "list" ? "/example" : mode === "create" ? "/example/new" : `/example/note-ssr${mode === "edit" ? "/edit" : ""}`
        const context = await handler.query(new Request(`http://localhost${path}`))
        assert.ok(!(context instanceof Response))
        assert.equal(context.matches.at(-1)?.route.id === "routes/example/note-edit", mode === "edit")
        const router = createStaticRouter(routes, context)
        const html = renderToStaticMarkup(
          createElement(I18nextProvider, { i18n },
            createElement(QueryClientProvider, { client: queryClient },
              createElement(TRPCProvider, {
                queryClient,
                trpcClient: trpc,
                children: createElement(UNSAFE_FrameworkContext.Provider, {
                  value: frameworkContext,
                  children: createElement(StaticRouterProvider, { context, router, hydrate: false }),
                }),
              }),
            ),
          ),
        )

        const expectedTitle = mode === "list" ? i18n.t("title") : mode === "view" ? "Server rendered note" : i18n.t(mode === "create" ? "form.createTitle" : "form.editTitle")
        assert.deepEqual(html.match(/<title>[^<]*<\/title>/g), [`<title>${expectedTitle}</title>`])

        if (!showSheet || mode === "list") {
          assert.equal(html.includes('role="dialog"'), false)
          continue
        }

        assert.ok(html.includes('role="dialog"'))
        assert.equal(html.match(/role="dialog"/g)?.length, 1, "Responsive overlays must SSR one copy of their content")
        assert.ok(html.includes('aria-modal="true"'))
        assert.ok(html.includes(`aria-label="${i18n.t("actions.close")}"`))
        for (const attribute of ["aria-labelledby", "aria-describedby"]) {
          const id = html.match(new RegExp(`${attribute}="([^"]+)"`))?.[1]
          assert.ok(id)
          assert.ok(html.includes(`id="${id}"`))
        }
        for (const slot of ["sheet-backdrop", "sheet-viewport", "sheet-popup"]) {
          const element = html.match(new RegExp(`<div[^>]*data-slot="${slot}"[^>]*>`))?.[0]
          assert.ok(element)
          assert.equal(/\shidden(?:=|\s|>)/.test(element), false, `${mode}: ${slot} must be visible during SSR`)
        }
        const viewport = html.match(/<div[^>]*data-slot="sheet-viewport"[^>]*>/)?.[0]
        const popup = html.match(/<div[^>]*data-slot="sheet-popup"[^>]*>/)?.[0]
        assert.ok(viewport?.includes("max-sm:grid-rows-[1fr_auto]"))
        assert.ok(viewport?.includes("max-sm:grid-cols-1"))
        assert.ok(viewport?.includes("max-sm:pt-12"))
        assert.ok(popup?.includes("max-sm:w-full"))
        assert.ok(popup?.includes("max-sm:rounded-t-2xl"))
        assert.ok(html.includes('data-slot="drawer-bar"'))
        assert.ok(html.includes("env(safe-area-inset-bottom,0px)"))

        if (mode === "create") {
          assert.ok(html.includes(i18n.t("form.createTitle")))
          assert.ok(html.includes('id="create-note-form"'))
          assert.ok(html.includes('name="title"'))
          assert.ok(html.includes('name="body"'))
          assert.equal(html.includes("Server rendered note"), false)
        } else {
          assert.ok(html.includes("Server rendered note"))
          assert.ok(html.includes("Notes available before hydration"), `${language} ${mode}: note body must render during SSR`)
          if (mode === "edit") {
            assert.ok(html.includes(i18n.t("form.editTitle")))
            assert.ok(html.includes('id="edit-note-form"'))
            assert.ok(html.includes('value="Server rendered note"'))
          } else {
            assert.equal(html.includes('id="edit-note-form"'), false)
          }
        }
      }
    }
  }

  console.info("PASS note route metadata keeps one title, and responsive sheets render one visible server copy with mobile drawer styles in English and Finnish")
} finally {
  queryClient.clear()
  await vite.close()
}
