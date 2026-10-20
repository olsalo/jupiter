import { removeScheduleAt, replaceScheduleAt, type ScheduleRule } from "~/lib/calendar/availability"
import type { Database } from "./scheduling"

export async function saveStaffSchedule(db: Database, { organizationId, staffMemberId, kind, replacement, at, timezone, previousAt }: {
  organizationId: string
  staffMemberId: string
  kind: "workingHours" | "breaks"
  replacement: ScheduleRule[]
  at: Date
  timezone: string
  previousAt?: Date | null
}) {
  const where = { organizationId, staffMemberId, locationId: null, isBreak: kind === "breaks" }
  const existing = await db.availabilityRule.findMany({ where })
  let rules: ScheduleRule[] = existing
  if (!where.isBreak && rules.length === 0) {
    const business = await db.availabilityRule.findMany({ where: { organizationId, staffMemberId: null, locationId: null, isBreak: false } })
    const settings = business.length ? null : await db.organizationSettings.findUnique({ where: { organizationId } })
    rules = business.length ? business : [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startMinute: (settings?.defaultStartHour ?? 8) * 60, endMinute: (settings?.defaultEndHour ?? 18) * 60, timezone, isActive: true, validFrom: null, validUntil: null }))
    rules = rules.filter((rule) => !rule.validFrom || +rule.validFrom < +at).map((rule) => ({ ...rule, validUntil: rule.validUntil && +rule.validUntil < +at ? rule.validUntil : at }))
  }
  if (previousAt && +previousAt !== +at) rules = removeScheduleAt(rules, previousAt)
  const updated = replaceScheduleAt(rules, replacement, at, timezone)
  await db.availabilityRule.deleteMany({ where })
  await db.availabilityRule.createMany({ data: updated.map(({ dayOfWeek, startMinute, endMinute, isActive, validFrom, validUntil, timezone }) => ({ ...where, dayOfWeek, startMinute, endMinute, isActive, validFrom: validFrom ?? null, validUntil: validUntil ?? null, timezone })) })
}
