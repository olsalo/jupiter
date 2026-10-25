import "dotenv/config"
import { parseArgs } from "node:util"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client.ts"
import { barberSeedOptions, seedBarberShop } from "./lib/barber-seed.ts"

async function main() {
  const { values } = parseArgs({ options: {
    "owner-name": { type: "string" },
    "owner-email": { type: "string" },
    help: { type: "boolean", short: "h" },
  } })
  if (values.help) {
    console.info('Usage: npm run db:seed:barber -- --owner-name "John Smith" --owner-email "john@example.com"')
    return
  }
  const parsed = barberSeedOptions.safeParse({ ownerName: values["owner-name"], ownerEmail: values["owner-email"]?.trim() })
  if (!parsed.success) throw new Error("Provide a non-empty --owner-name (up to 100 characters) and a valid --owner-email. Run with --help for an example")
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required — configure it in .env")
  const db = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL) })
  try {
    const result = await seedBarberShop(db, parsed.data)
    console.info(`${result.created ? "Created" : "Already exists:"} Northside Barbers (${result.organizationId})`)
    console.info(`Owner: ${parsed.data.ownerName} <${parsed.data.ownerEmail}>`)
    console.info("Sign in with the owner's email using the usual email code flow, then select Northside Barbers")
    console.info("Demo email delivery and reminders are disabled. Existing accounts and demo edits are preserved")
    console.info("If Stripe billing is enabled, use DEMO_BYPASS_ONBOARDING_PAYMENT=true for local demo access")
  } finally {
    await db.$disconnect()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Barber shop seed failed")
  process.exitCode = 1
})
