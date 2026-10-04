import "dotenv/config"
import assert from "node:assert/strict"
import { createTRPCClient, httpLink, TRPCClientError } from "@trpc/client"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import superjson from "superjson"
import { createServer } from "vite"

import type { AppRouter } from "../app/.server/main"

process.env.NODE_ENV = "test"
const vite = await createServer({
  configFile: false,
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
})

try {
  const { appRouter } = await vite.ssrLoadModule("/app/.server/main.ts") as typeof import("../app/.server/main")
  const { prisma } = await vite.ssrLoadModule("/app/lib/prisma.server.ts") as typeof import("../app/lib/prisma.server")
  const { themeCookie, localeCookie } = await vite.ssrLoadModule("/app/lib/cookies.server.ts") as typeof import("../app/lib/cookies.server")
  let response: Response | undefined
  const client = createTRPCClient<AppRouter>({
    links: [httpLink({
      url: "http://localhost/api/trpc",
      transformer: superjson,
      fetch: async (url, options) => {
        const request = new Request(String(url), options)
        response = await fetchRequestHandler({
          endpoint: "/api/trpc",
          req: request,
          router: appRouter,
          createContext: ({ resHeaders }) => ({
            headers: request.headers,
            request,
            responseHeaders: resHeaders,
            prisma,
            user: undefined,
            session: undefined,
            organizationId: null,
            formatLocale: "fi-FI",
            formatPreference: "eu",
            locale: "en",
          }),
        })
        return response
      },
    })],
  })

  for (const theme of ["dark", "light"] as const) {
    assert.deepEqual(await client.profile.updateTheme.mutate({ theme }), { theme })
    const cookie = response?.headers.get("set-cookie")
    assert.ok(cookie, "Theme must be persisted in the HTTP response before sign-in")
    assert.equal(await themeCookie.parse(cookie.split(";")[0]), theme)
    assert.match(cookie, /HttpOnly/i)
  }

  for (const locale of ["fi", "en"] as const) {
    assert.deepEqual(await client.profile.updateLocale.mutate({ locale }), { locale })
    const cookie = response?.headers.get("set-cookie")
    assert.ok(cookie, "Language must be persisted in the HTTP response before sign-in")
    assert.equal(await localeCookie.parse(cookie.split(";")[0]), locale)
    assert.match(cookie, /HttpOnly/i)
  }

  await assert.rejects(
    client.profile.updatePreferences.mutate({ locale: "fi" }),
    (error: unknown) =>
      error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED",
  )
  console.info("PASS Signed-out theme and language choices persist without granting profile access")
} finally {
  await vite.close()
}
