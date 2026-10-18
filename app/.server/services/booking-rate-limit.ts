import { createHash } from "node:crypto"
import { TRPCError } from "@trpc/server"
import type { PrismaClient } from "../../../generated/prisma/client"

// Only trust a header when the deployment proxy strips client-supplied values
export function bookingClientKey(headers: Headers) {
  const header = process.env.BOOKING_TRUSTED_IP_HEADER
  return createHash("sha256").update(header ? headers.get(header)?.split(",")[0]?.trim() ?? "unknown" : "unknown").digest("hex")
}
const attempts = new Map<string, { count: number; expires: number }>()
export function limitBookingLookup(headers: Headers) {
  const now = Date.now()
  for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key)
  const key = bookingClientKey(headers)
  const bucket = attempts.get(key) ?? { count: 0, expires: now + 60000 }
  if (attempts.size >= 10000 || ++bucket.count > 120) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Try again in a minute" })
  attempts.set(key, bucket)
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
    const perClient = await tx.auditLog.count({ where: { ...where, entityId: clientKey } })
    if (total >= (mutation ? 100 : 600) || perClient >= (mutation ? 10 : 120)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Try again in a minute" })
    await tx.auditLog.create({ data: { organizationId, action, entityType: "booking-request", entityId: clientKey } })
  })
}
