import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../../generated/prisma/client"
import { extendPrismaClient } from "prisma-prefixed-ids"

import { generateId } from "~/lib/id"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is required")
}

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient
  prismaConstructor?: typeof PrismaClient
}

// A regenerated client can have a new schema while Vite retains the old instance.
const cachedPrisma = globalForPrisma.prismaConstructor === PrismaClient
  ? globalForPrisma.prisma
  : undefined

const basePrisma =
  cachedPrisma ?? new PrismaClient({
    adapter: new PrismaPg(connectionString),
  })

const prefixes: Record<string, string> = {
  Account: "acct",
  Invitation: "inv",
  Member: "mem",
  Note: "note",
  Organization: "org",
  OrganizationSettings: "orgset",
  Session: "sess",
  Subscription: "sub",
  User: "usr",
  Verification: "ver",
}

export const prisma = cachedPrisma ?? extendPrismaClient(basePrisma, {
  idGenerator: generateId,
  prefixes,
})

if (process.env.NODE_ENV !== "production") {
  if (globalForPrisma.prisma && globalForPrisma.prisma !== prisma) {
    void globalForPrisma.prisma.$disconnect().catch(() => undefined)
  }
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaConstructor = PrismaClient
}
