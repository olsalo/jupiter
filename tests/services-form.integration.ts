import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { createStaticHandler, createStaticRouter, StaticRouterProvider } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query"
import { createInstance } from "i18next"
import { I18nextProvider } from "react-i18next"
import { createServer } from "vite"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({ configFile: false, cacheDir: "node_modules/.vite-tests/services-form", appType: "custom", resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/components": `${appPath}/components/ui`, "@coss/ui/lib": `${appPath}/lib` } }, server: { middlewareMode: true, ws: false, hmr: false, watch: null } })
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } })
try {
  const { default: NewService } = await vite.ssrLoadModule("/app/routes/services/new-service.tsx") as typeof import("../app/routes/services/new-service")
  const { ServiceFormSheet } = await vite.ssrLoadModule("/app/components/services/service-form-sheet.tsx") as typeof import("../app/components/services/service-form-sheet")
  const { ServiceCategoryDialog } = await vite.ssrLoadModule("/app/components/services/service-category-dialog.tsx") as typeof import("../app/components/services/service-category-dialog")
  const { serviceFormSchema, serviceCategorySchema } = await vite.ssrLoadModule("/app/lib/schemas/services.ts") as typeof import("../app/lib/schemas/services")
  const { TRPCProvider, trpc } = await vite.ssrLoadModule("/app/lib/trpc/client.tsx") as typeof import("../app/lib/trpc/client")
  const { resources } = await vite.ssrLoadModule("/app/locales/index.ts") as typeof import("../app/locales")
  const options = createTRPCOptionsProxy({ client: trpc, queryClient })
  queryClient.setQueryData(options.service.categories.queryKey(), [])
  queryClient.setQueryData(options.staff.list.queryKey(), [])
  queryClient.setQueryData(options.location.list.queryKey(), [])
  queryClient.setQueryData([...options.service.list.queryKey()], [{ id: "service-1", name: "Consultation", durationMinutes: 30 }])
  queryClient.setQueryData(options.organizations.general.queryKey(), { businessName: "Test business", businessId: null, weekStartsOn: 1, country: "FI", currency: "USD", location: "FI", timezone: "Europe/Helsinki", canManage: true })
  const i18n = createInstance()
  await i18n.init({ resources, lng: "en", defaultNS: "services", interpolation: { escapeValue: false } })
  const schema = serviceFormSchema((key) => i18n.t(key))
  const categorySchema = serviceCategorySchema((key) => i18n.t(key))
  assert.deepEqual(categorySchema.parse({ name: " Treatments ", serviceIds: [] }), { name: "Treatments", serviceIds: [] })
  for (const input of [{ name: " ", serviceIds: [] }, { name: "Treatments", serviceIds: ["same", "same"] }, { name: "Treatments", serviceIds: Array.from({ length: 101 }, (_, index) => String(index)) }]) {
    assert.equal(categorySchema.safeParse(input).success, false)
  }
  const values = { name: " Haircut ", description: "", durationMinutes: "60", bufferBeforeMinutes: "0", bufferAfterMinutes: "15", price: "65,50", deliveryType: "IN_PERSON", color: "#6366f1", isActive: true, staffIds: [], locationIds: [] }
  const parsed = schema.parse(values)
  assert.equal(parsed.name, "Haircut")
  assert.equal(parsed.categoryId, null)
  assert.equal(schema.parse({ ...values, categoryId: "category-1" }).categoryId, "category-1")
  assert.equal(parsed.price, "65.50")
  assert.equal(parsed.durationMinutes, 60)
  assert.equal(schema.parse({ ...values, price: "" }).price, null)
  assert.equal(schema.parse({ ...values, price: "0" }).price, "0")
  for (const [field, invalid] of [
    ["name", " "], ["durationMinutes", ""], ["durationMinutes", "4"], ["durationMinutes", "60.5"], ["durationMinutes", "1441"],
    ["bufferBeforeMinutes", "-1"], ["bufferAfterMinutes", "241"], ["price", "-20"], ["price", "2.123"], ["color", "bad"], ["staffIds", ["same", "same"]],
  ] as const) {
    const result = schema.safeParse({ ...values, [field]: invalid })
    assert.equal(result.success, false, `${field} rejects ${invalid}`)
    if (!result.success) assert.equal(result.error.issues[0]?.path[0], field)
  }
  const handler = createStaticHandler([{ path: "/services/new", Component: NewService }])
  const context = await handler.query(new Request("https://example.invalid/services/new"))
  assert.ok(!(context instanceof Response))
  const staticContext = context
  function render(context = staticContext) {
    const router = createStaticRouter(handler.dataRoutes, context)
    const routed = createElement(StaticRouterProvider, { router, context, hydrate: false })
    const provided = createElement(TRPCProvider, { queryClient, trpcClient: trpc, children: routed })
    return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(QueryClientProvider, { client: queryClient }, provided)))
  }
  const english = render()
  assert.match(english, /role="dialog"/)
  assert.match(english, /General/)
  assert.match(english, /aria-label="Category"/)
  assert.match(english, /No category/)
  assert.match(english, /Staff &amp; locations/)
  assert.match(english, /No team members taking appointments yet/)
  assert.match(english, /No locations yet/)
  assert.match(english, /USD/)
  assert.match(english, /Create service/)
  assert.match(english, /noValidate=""/)
  assert.doesNotMatch(english, /type="file"|Coming soon|\[object Object\]/)
  function renderCategory(mode: "create" | "edit" = "create") {
    const category = createElement(ServiceCategoryDialog, { open: true, flow: 1, mode, initialCategoryId: "treatments", categories: [{ id: "treatments", name: "Treatments", count: 1 }], onOpenChange: () => {}, onSaved: () => {} })
    const provided = createElement(TRPCProvider, { queryClient, trpcClient: trpc, children: category })
    return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(QueryClientProvider, { client: queryClient }, provided)))
  }
  queryClient.setQueryData([...options.service.get.queryKey({ id: "service-edit" })], { id: "service-edit", name: "Existing haircut", categoryId: null, category: null, description: "Existing description", durationMinutes: 45, bufferBeforeMinutes: 5, bufferAfterMinutes: 10, price: "65.50", currency: "EUR", deliveryType: "ONLINE", color: "#6366f1", isActive: false, staffServices: [], serviceLocations: [] })
  function renderEdit() {
    const edit = createElement(ServiceFormSheet, { serviceId: "service-edit" })
    const provided = createElement(TRPCProvider, { queryClient, trpcClient: trpc, children: edit })
    const editRouter = createStaticRouter([{ id: "0", path: "/services/new", Component: () => provided }], staticContext)
    const contextProvider = createElement(StaticRouterProvider, { router: editRouter, context: staticContext, hydrate: false })
    return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(QueryClientProvider, { client: queryClient }, contextProvider)))
  }
  const editEnglish = renderEdit()
  assert.match(editEnglish, /Edit service/)
  assert.match(editEnglish, /value="Existing haircut"/)
  assert.match(editEnglish, /Existing description/)
  assert.match(editEnglish, /value="45"/)
  assert.match(editEnglish, /value="65.50"/)
  assert.match(editEnglish, /Save changes/)
  assert.doesNotMatch(editEnglish, /Coming soon|Information architecture/)
  const editData = queryClient.getQueryData(options.service.get.queryKey({ id: "service-edit" }))
  assert.ok(editData)
  queryClient.setQueryData([...options.service.get.queryKey({ id: "service-edit" })], { ...editData, price: null })
  const unsetEdit = renderEdit()
  assert.match(unsetEdit, /placeholder="0"[^>]*value=""/)
  queryClient.setQueryData([...options.service.get.queryKey({ id: "service-edit" })], { ...editData, price: "0" })
  assert.match(renderEdit(), /placeholder="0"[^>]*value="0"/)
  const sourceCategory = { id: "treatments", name: "Treatments", organizationId: "org", description: null, sortOrder: 0, isActive: true, createdAt: new Date(), updatedAt: new Date() }
  queryClient.setQueryData(options.service.categories.queryKey(), [sourceCategory])
  const selectedCategoryContext = await handler.query(new Request("https://example.invalid/services/new?category=treatments"))
  assert.ok(!(selectedCategoryContext instanceof Response))
  const selectedCategoryCreate = render(selectedCategoryContext)
  assert.match(selectedCategoryCreate, /aria-label="Category"[\s\S]*?Treatments/)
  assert.doesNotMatch(selectedCategoryCreate, /No category/)
  queryClient.setQueryData(options.service.get.queryKey({ id: "service-edit" }), { ...editData, categoryId: "treatments", category: sourceCategory })
  const duplicateContext = await handler.query(new Request("https://example.invalid/services/new?duplicate=service-edit"))
  assert.ok(!(duplicateContext instanceof Response))
  const duplicate = render(duplicateContext)
  assert.match(duplicate, /New service/)
  assert.match(duplicate, /value="Existing haircut \(copy\)"/)
  assert.match(duplicate, /Existing description/)
  assert.match(duplicate, /value="45"/)
  assert.match(duplicate, /value="65.50"/)
  assert.match(duplicate, /aria-label="Category"[\s\S]*?Treatments/)
  assert.doesNotMatch(duplicate, /Edit service|Save changes/)
  queryClient.setQueryData(options.service.categories.queryKey(), [])
  const categoryEnglish = renderCategory()
  assert.match(categoryEnglish, /data-slot="sheet-popup"/)
  assert.match(categoryEnglish, /New category/)
  assert.match(categoryEnglish, /Search services/)
  assert.match(categoryEnglish, /Create category/)
  const categoryEdit = renderCategory("edit")
  assert.match(categoryEdit, /Edit category/)
  assert.doesNotMatch(categoryEdit, /Delete category|Deletes the category/)
  await i18n.changeLanguage("fi")
  const finnish = render()
  assert.match(finnish, /Yleiset tiedot/)
  assert.match(finnish, /Tekijät ja toimipaikat/)
  assert.match(finnish, /Luo palvelu/)
  assert.match(renderEdit(), /Muokkaa palvelua/)
  assert.match(renderEdit(), /Tallenna muutokset/)
  const categoryFinnish = renderCategory()
  assert.match(categoryFinnish, /Uusi kategoria/)
  assert.match(categoryFinnish, /Hae palveluita/)
  assert.match(categoryFinnish, /Luo kategoria/)
  queryClient.removeQueries(options.service.get.queryFilter({ id: "service-edit" }))
  const loadingEdit = renderEdit()
  assert.match(loadingEdit, /data-slot="overlay-loading"/)
  assert.doesNotMatch(loadingEdit, /data-slot="(?:sheet|drawer)-footer"/)
  queryClient.removeQueries(options.service.list.queryFilter())
  const loadingCategory = renderCategory()
  assert.match(loadingCategory, /data-slot="(?:sheet|drawer)-footer"/, "Category footer is visible while services load")
  queryClient.removeQueries(options.staff.list.queryFilter())
  assert.match(render(), /data-slot="(?:sheet|drawer)-footer"/, "New service footer is visible before assignment options load")
  console.info("PASS service and category form validation, money normalization, direct-route SSR, empty assignments and Finnish labels")
} finally {
  queryClient.clear()
  await vite.close()
}
