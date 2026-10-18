import { TRPCError } from "@trpc/server"
import type { PrismaClient } from "../../../generated/prisma/client"
import { Prisma } from "../../../generated/prisma/client"
import { readTimeOffRecurrence, timeOffIntervals, type TimeOffValues } from "~/lib/team-time-off"
import { assertScope, schedulingLock, type Database } from "./scheduling"

export async function getBlockedTimeInRange(db: Database, organizationId: string, range: { from: Date; to: Date }, scope: { staffMemberId?: string | null; locationId?: string } = {}) {
  const records = await db.blockedTime.findMany({ where: {
    organizationId,
    ...scope,
    OR: [
      { startsAt: { lt: range.to }, endsAt: { gt: range.from } },
      { recurrence: { not: Prisma.DbNull }, startsAt: { lt: range.to } },
    ],
  }, orderBy: { startsAt: "asc" } })
  return records.flatMap((record) => {
    const recurrence = readTimeOffRecurrence(record.recurrence)
    if (!recurrence) return record.startsAt < range.to && record.endsAt > range.from ? [record] : []
    return timeOffIntervals(recurrence, recurrence.timezone, range).map((interval) => ({ ...record, ...interval }))
  }).sort((a, b) => +a.startsAt - +b.startsAt)
}

export function addStaffTimeOff(db: PrismaClient, organizationId: string, staffMemberId: string, values: TimeOffValues) {
  return db.$transaction(async (tx) => {
    await schedulingLock(tx, organizationId)
    await assertScope(tx, organizationId, { staffMemberId })
    const staff = await tx.staffMember.findUniqueOrThrow({ where: { id: staffMemberId } })
    const settings = await tx.organizationSettings.findUnique({ where: { organizationId } })
    const timezone = staff.timezone ?? settings?.timezone ?? "Europe/Helsinki"
    const intervals = timeOffIntervals({ ...values, repeat: "none" }, timezone)
    if (intervals.some(({ startsAt, endsAt }) => endsAt <= startsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "End must be after start" })
    return tx.blockedTime.createMany({ data: intervals.map((interval) => ({ organizationId, staffMemberId, title: values.title, ...interval,
      ...(values.repeat !== "none" ? { recurrence: { ...values, timezone } } : {}),
    })) })
  })
}
