import "dotenv/config"
import { createServer } from "vite"

const vite = await createServer({
  configFile: false,
  appType: "custom",
  resolve: { alias: { "~": new URL("../app", import.meta.url).pathname } },
  server: { middlewareMode: true, hmr: false, watch: null },
})
const { prisma } = await vite.ssrLoadModule("/app/lib/prisma.server.ts") as typeof import("../app/lib/prisma.server")
const { Prisma } = await vite.ssrLoadModule("/generated/prisma/client.ts") as typeof import("../generated/prisma/client")
const { generateId } = await import(new URL("../app/lib/id.ts", import.meta.url).href) as typeof import("../app/lib/id")

try {
  const count = await prisma.$transaction(async (tx) => {
    // Existing forms can predate sections. Serialize with editor/publish writes.
    const forms = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM form
      WHERE NOT EXISTS (SELECT 1 FROM form_section WHERE "formId" = form.id)
      FOR UPDATE
    `)
    let added = 0
    for (const form of forms) {
      if (await tx.formSection.count({ where: { formId: form.id } })) continue
      await tx.formSection.create({ data: { id: generateId("section"), formId: form.id } })
      await tx.form.update({ where: { id: form.id }, data: { draftRevision: { increment: 1 } } })
      added += 1
    }
    return added
  }, { timeout: 30000 })
  console.info(`Added default sections to ${count} existing forms`)
} finally {
  await prisma.$disconnect()
  await vite.close()
}
