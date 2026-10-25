import assert from "node:assert/strict"
import { hydrate, QueryClient, QueryObserver, timeoutManager } from "@tanstack/react-query"
import superjson from "superjson"
import { createServer } from "vite"
import { createStaticHandler } from "react-router"

// Server query caches use collection timers that must not keep this test process open
timeoutManager.setTimeoutProvider({
  setTimeout: (callback, delay) => setTimeout(callback, delay).unref(),
  clearTimeout: (id) => clearTimeout(id),
  setInterval: (callback, delay) => setInterval(callback, delay).unref(),
  clearInterval: (id) => clearInterval(id),
})

const appPath = new URL("../app", import.meta.url).pathname
const vite = await createServer({
  configFile: false, cacheDir: "node_modules/.vite-tests/public-booking-hydration", appType: "custom",
  resolve: { alias: { "~": appPath, "@": appPath, "@coss/ui/components": `${appPath}/components/ui`, "@coss/ui/lib": `${appPath}/lib` } },
  plugins: [{
    name: "booking-loader-fixture",
    transform(_code, id) {
      if (id !== `${appPath}/lib/trpc/server.ts`) return
      return `
        import { TRPCError } from "@trpc/server"
        let result = "NOT_FOUND"
        export function setResult(value) { result = value }
        export async function createTRPC() {
          const procedure = { queryOptions(input, options) {
            return { ...options, queryKey: ["booking", input], queryFn: async () => {
              if (result === "success") return { organization: { name: "Aino" } }
              if (result === "unexpected") throw new Error("Private server details")
              throw new TRPCError({ code: result, message: "Private server details", cause: new Error("Private cause") })
            } }
          } }
          return { booking: { getPage: procedure, getManagementPage: procedure, getReschedulePage: procedure } }
        }
      `
    },
  }],
  server: { middlewareMode: true, ws: false, hmr: false, watch: null },
})
try {
  for (const route of ["public-booking", "booking-details", "reschedule-booking"]) {
    const { loader, clientLoader } = await vite.ssrLoadModule(`/app/routes/booking/${route}.tsx`) as typeof import("../app/routes/booking/public-booking")
    const fixture = await vite.ssrLoadModule("/app/lib/trpc/server.ts") as { setResult: (result: string) => void }
    for (const outcome of ["NOT_FOUND", "INTERNAL_SERVER_ERROR", "TOO_MANY_REQUESTS", "unexpected", "success"]) {
      fixture.setResult(outcome)
      const initial = await loader({ params: { organizationSlug: "test", bookingCode: "code" } } as unknown as Parameters<typeof loader>[0])
      const expectedStatus = outcome === "success" ? 200 : outcome === "NOT_FOUND" ? 404 : outcome === "TOO_MANY_REQUESTS" ? 429 : 500
      const handler = createStaticHandler([{ path: "/", loader: () => initial }])
      const response = await handler.query(new Request("https://example.invalid/"))
      assert.ok(!(response instanceof Response))
      assert.equal(response.statusCode, expectedStatus, `${route} returns the matching document HTTP status`)
      const transported = JSON.parse(JSON.stringify(initial.data.queryClient))
      const client = new QueryClient({ defaultOptions: { hydrate: { deserializeData: superjson.deserialize } } })
      hydrate(client, transported)
      assert.equal(transported.queries.length, 1, "Both successful and failed server results reach the browser")
      let requests = 0
      const observer = new QueryObserver(client, {
        queryKey: transported.queries[0].queryKey,
        queryFn: async () => { requests += 1; return { organization: { name: "Recovered" } } },
        retry: false, retryOnMount: false, staleTime: 60000,
      })
      const unsubscribe = observer.subscribe(() => {})
      try {
        const result = observer.getCurrentResult()
        assert.equal(result.isPending, false, "The first client render already has the server result")
        assert.equal(requests, 0, "Mounting does not repeat the initial server request")
        if (outcome === "success") {
          assert.equal(result.data?.organization.name, "Aino")
        } else {
          assert.equal(result.status, "error")
          assert.equal((result.error as unknown as { data: { code: string } }).data.code, outcome === "unexpected" ? "INTERNAL_SERVER_ERROR" : outcome)
          assert.doesNotMatch(JSON.stringify(transported), /Private server details|Private cause|stack/, "Server error details stay on the server")
        }
        await observer.refetch()
        assert.equal(requests, 1, "Client queries can retry and refresh after hydration")
        assert.equal(observer.getCurrentResult().data?.organization.name, "Recovered")
      } finally {
        unsubscribe()
        client.clear()
      }
    }
    assert.equal(clientLoader(), null, "Later navigations leave fetching to client queries")
  }
  console.info("PASS all public booking loaders return matching HTTP statuses and server success and errors hydrate without a loading flash or duplicate request, with client retries preserved")
} finally {
  await vite.close()
}
