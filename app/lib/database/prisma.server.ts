import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../../../generated/prisma/client"

import { generateId } from "~/lib/database/id"
import { createIdWriteTransformer } from "~/lib/database/prisma-ids.server.ts"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is required")
}

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient
  prismaConstructor?: typeof PrismaClient
  prismaIdGenerator?: typeof generateId
}

// A regenerated client can have a new schema while Vite retains the old instance.
const cachedPrisma = globalForPrisma.prismaConstructor === PrismaClient && globalForPrisma.prismaIdGenerator === generateId
  ? globalForPrisma.prisma
  : undefined

const basePrisma =
  cachedPrisma ?? new PrismaClient({
    adapter: new PrismaPg(connectionString),
  })

const withGeneratedIds = createIdWriteTransformer(basePrisma)

export const prisma = cachedPrisma ?? basePrisma.$extends({
  name: "generatedIds",
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        return query(withGeneratedIds(model, operation, args) as typeof args)
      },
    },
  },
}) as PrismaClient

if (process.env.NODE_ENV !== "production") {
  if (globalForPrisma.prisma && globalForPrisma.prisma !== prisma) {
    void globalForPrisma.prisma.$disconnect().catch(() => undefined)
  }
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaConstructor = PrismaClient
  globalForPrisma.prismaIdGenerator = generateId
}
