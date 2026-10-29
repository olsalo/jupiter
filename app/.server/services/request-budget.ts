import { createHash } from "node:crypto"
import { TRPCError } from "@trpc/server"
import type { PrismaClient } from "../../../generated/prisma/client"

export type RequestBudget = { key: string; maximum: number; windowMs: number }

// Expiring counters reuse the existing verification store. Locks make all budgets
// atomic across instances without keeping an ever-growing in-process IP map.
export async function consumeRequestBudgets(db: PrismaClient, budgets: RequestBudget[], now = new Date()) {
  return db.$transaction(async (tx) => {
    const entries = budgets.map((budget) => ({ ...budget, id: `budget:${createHash("sha256").update(budget.key).digest("hex")}` })).sort((a, b) => a.id.localeCompare(b.id))
    for (const entry of entries) {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${entry.id}, 0))::text`
    }
    for (const entry of entries) {
      const stored = await tx.verification.findUnique({ where: { id: entry.id } })
      const current = stored && stored.expiresAt > now ? Number(stored.value) : 0
      if (!Number.isSafeInteger(current) || current >= entry.maximum) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Please try again later" })
      }
      const expiresAt = stored && stored.expiresAt > now ? stored.expiresAt : new Date(+now + entry.windowMs)
      await tx.verification.upsert({ where: { id: entry.id }, create: { id: entry.id, identifier: "request-budget", value: String(current + 1), expiresAt }, update: { value: String(current + 1), expiresAt } })
    }
  })
}

export function otpRequestBudgets(email: string): RequestBudget[] {
  const recipient = email.trim().toLowerCase()
  return [
    { key: "otp:global:hour", maximum: 200, windowMs: 3600000 },
    { key: "otp:global:day", maximum: 1000, windowMs: 86400000 },
    { key: `otp:${recipient}:cooldown`, maximum: 1, windowMs: 60000 },
    { key: `otp:${recipient}:hour`, maximum: 5, windowMs: 3600000 },
    { key: `otp:${recipient}:day`, maximum: 10, windowMs: 86400000 },
  ]
}
