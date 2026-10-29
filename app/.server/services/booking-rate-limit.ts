import { createHash } from "node:crypto"
import { TRPCError } from "@trpc/server"
import type { PrismaClient } from "../../../generated/prisma/client"
import { trustedClientIp } from "~/lib/http/client-ip.server"
import { consumeRequestBudgets } from "./request-budget"

export function bookingClientKey(headers: Headers) {
  const ip = trustedClientIp(headers)
  if (!ip && process.env.NODE_ENV === "production") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Booking client IP configuration is missing or invalid" })
  }
  return ip ? createHash("sha256").update(ip).digest("hex") : null
}
export async function limitBookingLookup(db: PrismaClient, headers: Headers) {
  const key = bookingClientKey(headers)
  if (key) await consumeRequestBudgets(db, [{ key: `booking:lookup:${key}`, maximum: 120, windowMs: 60000 }])
}

// PostgreSQL-backed limits survive restarts and work across application instances
export async function limitPublicBooking(db: PrismaClient, headers: Headers, organizationId: string, mutation: boolean) {
  const clientKey = bookingClientKey(headers)
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`booking-limit:${organizationId}`}, 0))::text`
    const since = new Date(Date.now() - 60000)
    const action = mutation ? "booking.request.write" : "booking.request.read"
    const where = { organizationId, action, createdAt: { gte: since } }
    const total = await tx.auditLog.count({ where })
    const perClient = clientKey ? await tx.auditLog.count({ where: { ...where, entityId: clientKey } }) : 0
    if (total >= (mutation ? 100 : 600) || perClient >= (mutation ? 10 : 120)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Try again in a minute" })
    await tx.auditLog.create({ data: { organizationId, action, entityType: "booking-request", entityId: clientKey } })
  })
}
