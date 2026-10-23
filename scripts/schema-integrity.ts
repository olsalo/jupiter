import "dotenv/config"
import { readFile } from "node:fs/promises"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client.ts"
import { backfill, checks, postChecks, version } from "../prisma/schema-changes/20261022-integrity.ts"

type Model = { name: string; table: string; direct: boolean; links: { field: string; target: string; required: boolean }[]; anchor?: { field: string; target: string } }
const schema = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const models = new Map<string, Model>()
for (const match of schema.matchAll(/^\s*model (\w+) \{([\s\S]*?)^\}/gm)) {
  const [, name, body] = match
  const links: Model["links"] = []
  for (const field of body.matchAll(/^\s*\w+\s+(\w+)(\?)?\s+@relation\([^\n]*?fields: \[([^\]]+)\], references: \[([^\]]+)\]/gm)) {
    const fields = field[3].split(",").map((value) => value.trim())
    const refs = field[4].split(",").map((value) => value.trim())
    const idIndex = refs.indexOf("id")
    if (idIndex !== -1) links.push({ field: fields[idIndex], target: field[1], required: !field[2] })
  }
  models.set(name, { name, table: body.match(/@@map\("([^"]+)"\)/)?.[1] ?? name, direct: /^\s*organizationId\s+String/m.test(body), links })
}
const tenant = new Set(["Organization", ...[...models.values()].filter((model) => model.direct).map((model) => model.name)])
for (let pass = 0; pass < models.size; pass++) {
  for (const model of models.values()) {
    if (tenant.has(model.name)) continue
    const anchor = model.links.find((link) => link.required && tenant.has(link.target))
    if (anchor) { model.anchor = anchor; tenant.add(model.name) }
  }
}
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
function owner(model: Model, alias: string, depth = 0): string {
  if (model.name === "Organization") return `${alias}.id`
  if (model.direct) return `${alias}."organizationId"`
  if (!model.anchor) throw new Error(`Missing owner for ${model.name}`)
  const parent = models.get(model.anchor.target)!
  const nextAlias = `p${depth}`
  return `(SELECT ${owner(parent, nextAlias, depth + 1)} FROM ${quote(parent.table)} ${nextAlias} WHERE ${nextAlias}.id = ${alias}.${quote(model.anchor.field)})`
}
const db = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) })
try {
  if (!process.argv.includes("--apply")) {
    const failures: string[] = []
    const tables = new Set((await db.$queryRawUnsafe<{ tablename: string }[]>(`SELECT tablename FROM pg_tables WHERE schemaname = current_schema()`)).map((row) => row.tablename))
    for (const model of models.values()) {
      if (!tenant.has(model.name) || !tables.has(model.table)) continue
      for (const link of model.links.filter((link) => tenant.has(link.target))) {
        const target = models.get(link.target)!
        if (!tables.has(target.table)) continue
        const [result] = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) AS count FROM ${quote(model.table)} s JOIN ${quote(target.table)} t ON t.id = s.${quote(link.field)} WHERE ${owner(model, "s")} IS DISTINCT FROM ${owner(target, "t")}`)
        if (Number(result.count)) failures.push(`${model.name}.${link.field}: ${result.count} cross-business links`)
      }
    }
    for (const [table, name, condition] of checks) {
      if (!tables.has(table)) continue
      const [result] = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) AS count FROM ${quote(table)} WHERE NOT (${condition})`)
      if (Number(result.count)) failures.push(`${name}: ${result.count} invalid rows`)
    }
    if (tables.has("organization_settings")) {
      const [steps] = await db.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) AS count FROM organization_settings WHERE "onboardingStep" IS NOT NULL AND "onboardingStep" NOT IN ('availability', 'holidays')`)
      if (Number(steps.count)) failures.push(`${steps.count} unknown onboarding steps`)
    }
    if (failures.length) throw new Error(`Schema preflight failed:\n${failures.join("\n")}`)
    console.info(`PASS schema preflight: tenant relations, scheduling constraints and onboarding values`)
  } else {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtextextended('jupiter:schema-integrity', 0))`)
      await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS jupiter_schema_change (version text PRIMARY KEY, "appliedAt" timestamptz NOT NULL DEFAULT now())`)
      const applied = await tx.$queryRawUnsafe<{ version: string }[]>(`SELECT version FROM jupiter_schema_change WHERE version = $1`, version)
      if (!applied.length) {
        for (const sql of backfill) await tx.$executeRawUnsafe(sql)
        await tx.$executeRawUnsafe(`INSERT INTO jupiter_schema_change(version) VALUES ($1)`, version)
      }
      // Prisma does not express CHECK constraints or the optional/assignment tenant guards.
      // Reapply these idempotently after every db:push, alongside its native composite FKs.
      for (const [table, name, condition] of [...checks, ...postChecks]) {
        await tx.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE ${quote(table)} ADD CONSTRAINT ${quote(name)} CHECK (${condition}); EXCEPTION WHEN duplicate_object THEN NULL; END $$`)
      }
      const branches = [...models.values()].filter((model) => tenant.has(model.name)).map((model) => {
        if (model.name === "Organization") return `WHEN '${model.table}' THEN RETURN row_id;`
        if (model.direct) return `WHEN '${model.table}' THEN SELECT "organizationId" INTO result FROM ${quote(model.table)} WHERE id = row_id; RETURN result;`
        const parent = models.get(model.anchor!.target)!
        return `WHEN '${model.table}' THEN SELECT jupiter_tenant_owner('${parent.table}', ${quote(model.anchor!.field)}) INTO result FROM ${quote(model.table)} WHERE id = row_id; RETURN result;`
      }).join("\n")
      await tx.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION jupiter_tenant_owner(table_name text, row_id text) RETURNS text LANGUAGE plpgsql VOLATILE AS $$ DECLARE result text; BEGIN IF row_id IS NULL THEN RETURN NULL; END IF; CASE table_name ${branches} ELSE RAISE EXCEPTION 'Unknown tenant table %', table_name; END CASE; END $$`)
      for (const model of models.values()) {
        if (!tenant.has(model.name)) continue
        const rowOwner = (row: string) => model.name === "Organization" ? `${row}.id` : model.direct ? `${row}."organizationId"` : `jupiter_tenant_owner('${models.get(model.anchor!.target)!.table}', ${row}.${quote(model.anchor!.field)})`
        const validation = model.links.filter((link) => tenant.has(link.target)).map((link) => `IF NEW.${quote(link.field)} IS NOT NULL AND tenant_id IS DISTINCT FROM jupiter_tenant_owner('${models.get(link.target)!.table}', NEW.${quote(link.field)}) THEN RAISE EXCEPTION 'Cross-business relation: ${model.table}.${link.field}' USING ERRCODE = '23503'; END IF;`).join("\n")
        await tx.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION ${quote(`jupiter_tenant_${model.table}`)}() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE tenant_id text; BEGIN tenant_id := ${rowOwner("NEW")}; IF TG_OP = 'UPDATE' THEN IF tenant_id IS DISTINCT FROM ${rowOwner("OLD")} THEN RAISE EXCEPTION 'Business ownership is immutable' USING ERRCODE = '23503'; END IF; END IF; ${validation} RETURN NEW; END $$`)
        await tx.$executeRawUnsafe(`DROP TRIGGER IF EXISTS jupiter_tenant_guard ON ${quote(model.table)}`)
        await tx.$executeRawUnsafe(`CREATE TRIGGER jupiter_tenant_guard BEFORE INSERT OR UPDATE ON ${quote(model.table)} FOR EACH ROW EXECUTE FUNCTION ${quote(`jupiter_tenant_${model.table}`)}()`)
      }
    }, { timeout: 120000 })
    console.info(`PASS applied ${version}: backfill, database checks and tenant guards`)
  }
} finally {
  await db.$disconnect()
}
