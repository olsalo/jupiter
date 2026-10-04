import "dotenv/config"
import { createServer } from "vite"

const vite = await createServer({
  configFile: false,
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
})
const { prisma } = await vite.ssrLoadModule("/app/lib/prisma.server.ts") as typeof import("../app/lib/prisma.server")
const { getPublishedForm } = await vite.ssrLoadModule("/app/.server/services/forms/public-form.ts") as typeof import("../app/.server/services/forms/public-form")
const { getFormSettings } = await vite.ssrLoadModule("/app/.server/services/forms/form-settings.ts") as typeof import("../app/.server/services/forms/form-settings")

try {
  const identifier = process.argv[2]
  const forms = await prisma.form.findMany({
    where: identifier ? { OR: [{ id: identifier }, { slug: identifier }] } : undefined,
    orderBy: { updatedAt: "desc" },
    take: identifier ? 1 : 5,
    select: {
      id: true, slug: true, organizationId: true, enabled: true, status: true,
      publishedVersion: true, startsAt: true, closesAt: true, responseLimit: true,
      updatedAt: true, _count: { select: { submissions: true } },
    },
  })
  for (const { organizationId, ...form } of forms) {
    let availability: string
    try {
      await getPublishedForm(prisma, form.id)
      availability = "available"
    } catch (error) {
      availability = error instanceof Error ? error.message : String(error)
    }
    console.info(JSON.stringify({ ...form, settings: await getFormSettings(prisma, organizationId, form.id), availability }))
  }
} finally {
  await prisma.$disconnect()
  await vite.close()
}
