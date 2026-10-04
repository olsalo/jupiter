import "dotenv/config"
import assert from "node:assert/strict"
import { createServer } from "vite"

process.env.NODE_ENV = "test"
const vite = await createServer({
  configFile: false,
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
})

type PrismaModule = typeof import("../app/lib/prisma.server")
const loadPrisma = () => vite.ssrLoadModule("/app/lib/prisma.server.ts") as Promise<PrismaModule>
const invalidate = async (url: string) => {
  const module = await vite.environments.ssr.moduleGraph.getModuleByUrl(url)
  assert.ok(module, `Module was not loaded: ${url}`)
  vite.environments.ssr.moduleGraph.invalidateModule(module)
}

let prisma: PrismaModule["prisma"] | undefined

try {
  prisma = (await loadPrisma()).prisma

  // Editing an unrelated module must preserve the connection pool.
  await invalidate("/app/lib/prisma.server.ts")
  const cached = (await loadPrisma()).prisma
  assert.equal(cached, prisma)

  // Regeneration reloads the generated constructor, just as a schema change does.
  await invalidate("/generated/prisma/internal/class.ts")
  await invalidate("/generated/prisma/client.ts")
  await invalidate("/app/lib/prisma.server.ts")
  const refreshed = (await loadPrisma()).prisma
  assert.notEqual(refreshed, prisma)
  prisma = refreshed

  // Subsequent hot reloads reuse the new client instead of creating another pool.
  await invalidate("/app/lib/prisma.server.ts")
  assert.equal((await loadPrisma()).prisma, refreshed)
  console.info("PASS Prisma cache survives ordinary reloads and refreshes after client regeneration")
} finally {
  await prisma?.$disconnect()
  await vite.close()
}
