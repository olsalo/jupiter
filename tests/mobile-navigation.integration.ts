import "dotenv/config"
import assert from "node:assert/strict"
import { QueryObserver, type QueryKey } from "@tanstack/react-query"
import { createServer } from "vite"

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({
  configFile: false,
  cacheDir: "node_modules/.vite-tests/mobile-navigation",
  appType: "custom",
  resolve: { alias: {
    "~": appPath,
    "@": appPath,
    "@coss/ui/components": `${appPath}/components/ui`,
    "@coss/ui/lib": `${appPath}/lib`,
  } },
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window")

try {
  const { getClientTRPC } = await vite.ssrLoadModule("/app/lib/trpc/client.tsx") as typeof import("../app/lib/trpc/client")
  type ClientLoader = (args: { request: Request }) => unknown
  const routes: { path: string; clientLoader: ClientLoader }[] = []
  for (const [path, module] of [
    ["/example", "/app/routes/example/example.tsx"],
    ["/team", "/app/routes/team/team.tsx"],
    ["/team-v2", "/app/routes/team-v2/team.tsx"],
    ["/services", "/app/routes/services/services.tsx"],
    ["/booking-page", "/app/routes/booking-pages/booking-pages.tsx"],
    ["/customers", "/app/routes/customers/customers.tsx"],
    ["/calendar", "/app/routes/calendar/calendar.tsx"],
  ]) {
    const { clientLoader } = await vite.ssrLoadModule(module) as { clientLoader: ClientLoader }
    routes.push({ path, clientLoader })
  }

  for (const desktop of [false, true]) {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { matchMedia: () => ({ matches: desktop }) },
    })
    const { queryClient, trpc } = getClientTRPC()
    try {
      for (const { path, clientLoader } of routes) {
        const keys: QueryKey[] = path === "/services"
          ? [trpc.service.list.queryKey(), trpc.service.categories.queryKey()]
          : path === "/booking-page" ? [trpc.bookingPage.get.queryKey()]
          : path === "/customers" ? [trpc.customer.list.queryKey()]
          : path === "/calendar" ? [trpc.appointment.list.queryKey({ from: new Date("2026-10-19T00:00:00Z"), to: new Date("2026-10-26T00:00:00Z") })]
          : [path === "/example" ? trpc.example.list.queryKey() : trpc.team.list.queryKey()]

        for (const queryKey of keys) {
          let fetches = 0
          const options = {
            queryKey,
            queryFn: async () => {
              fetches += 1
              return ["fresh"]
            },
            retry: false,
          }
          const navigate = (suffix = "") => clientLoader({
            request: new Request(`https://example.test${path}${suffix}`),
          })
          const mount = async () => {
            const observer = new QueryObserver(queryClient, options)
            const unsubscribe = observer.subscribe(() => {})
            await queryClient.getQueryCache().find({ queryKey, exact: true })?.promise
            unsubscribe()
          }

          queryClient.setQueryData(queryKey, ["cached"])
          for (const suffix of ["", "?search=test", "/", "/new", "/person-id", ""]) {
            await navigate(suffix)
            await mount()
            assert.deepEqual(queryClient.getQueryData(queryKey), ["cached"], `${path} retains fresh cache`)
            assert.equal(fetches, 0, `${path} does not refetch on fresh revisits`)
          }

          queryClient.setQueryData(queryKey, ["stale"], { updatedAt: Date.now() - 61_000 })
          await navigate()
          assert.deepEqual(queryClient.getQueryData(queryKey), ["stale"], "Stale content stays visible while refreshing")
          await mount()
          assert.equal(fetches, 1, "Stale pages refresh on mount")

          await queryClient.invalidateQueries({ queryKey, exact: true })
          await navigate()
          await mount()
          assert.equal(fetches, 2, "Mutation invalidation still refreshes the page")

          queryClient.removeQueries({ queryKey, exact: true })
          await navigate()
          await mount()
          assert.equal(fetches, 3, "Uncached pages still fetch")
        }
      }
    } finally {
      queryClient.clear()
    }
  }
  console.info("PASS mobile and desktop navigation reuse fresh cache and refresh stale, invalidated, and uncached pages")
} finally {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow)
  else Reflect.deleteProperty(globalThis, "window")
  await vite.close()
}
