import { Temporal } from "@js-temporal/polyfill"
import { recurringHolidayRangesOverlap, type BusinessHoliday } from "~/lib/business/business-holidays"
import { z } from "~/lib/validation/zod"
const businessDate = z.string().refine((value) => { try { Temporal.PlainDate.from(value); return /^\d{4}-\d{2}-\d{2}$/.test(value) } catch { return false } })
const weeklyHours = z.array(z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
  timezone: z.string().min(1),
  isActive: z.boolean(),
  validFrom: z.date().nullable().optional(),
  validUntil: z.date().nullable().optional(),
}).refine((rule) => rule.endMinute > rule.startMinute, { path: ["endMinute"], message: "Choose an end time after the start time" })).max(100)

export const businessHolidaySchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().trim().max(120),
  labels: z.object({ en: z.string().max(300), fi: z.string().max(300) }).optional(),
  date: businessDate,
  endDate: z.union([businessDate, z.literal("")]).optional(),
  enabled: z.boolean(),
  closed: z.boolean(),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
}).superRefine((value, ctx) => {
  if (value.endDate && value.endDate < value.date) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Choose an end date on or after the start date" })
  if (value.id.startsWith("custom-") && value.endDate && businessDate.safeParse(value.date).success && businessDate.safeParse(value.endDate).success && value.endDate >= value.date && Temporal.PlainDate.from(value.date).until(Temporal.PlainDate.from(value.endDate)).days > 365) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Choose a holiday range of one year or less" })
  if (value.enabled && !value.closed && value.startMinute >= value.endMinute) ctx.addIssue({ code: "custom", path: ["endMinute"], message: "Choose an end time after the start time" })
  if (value.id.startsWith("custom-") && !value.name) ctx.addIssue({ code: "custom", path: ["name"], message: "Enter a holiday name" })
})

export const businessExceptionSchema = businessHolidaySchema.safeExtend({
  id: z.string().min(1).max(128).startsWith("exception-"),
  name: z.string().trim().min(1).max(120),
})

export const businessScheduleSchema = z.object({
  workingHours: weeklyHours,
  breaks: weeklyHours,
  holidays: z.array(businessHolidaySchema).max(100),
}).superRefine((value, ctx) => {
  const ids = new Set<string>()
  value.holidays.forEach((holiday, index) => {
    if (ids.has(holiday.id)) ctx.addIssue({ code: "custom", path: ["holidays", index, "name"], message: "Choose each holiday once" })
    ids.add(holiday.id)
    if (!holiday.id.startsWith("custom-") && holiday.name !== "") ctx.addIssue({ code: "custom", path: ["holidays", index, "name"], message: "Default holiday names cannot be changed" })
    if (holiday.enabled && value.holidays.slice(0, index).some((entry) => entry.enabled && (holiday.id.startsWith("custom-") || entry.id.startsWith("custom-")) && recurringHolidayRangesOverlap(entry, holiday))) ctx.addIssue({ code: "custom", path: ["holidays", index, "date"], message: "There is already a holiday on this date" })
  })
})
export type BusinessHolidayValues = z.infer<typeof businessHolidaySchema>
export type BusinessScheduleValues = z.infer<typeof businessScheduleSchema>

export function createBusinessScheduleSchema(defaultHolidays: BusinessHoliday[]) {
  const defaults = new Set(defaultHolidays.filter((holiday) => !holiday.id.startsWith("custom-")).map((holiday) => holiday.id))
  return businessScheduleSchema.superRefine((value, ctx) => {
    const ids = new Set(value.holidays.map((holiday) => holiday.id))
    value.holidays.forEach((holiday, index) => {
      if (!holiday.id.startsWith("custom-") && !defaults.has(holiday.id)) ctx.addIssue({ code: "custom", path: ["holidays", index, "name"], message: "Choose a holiday for your country" })
    })
    if ([...defaults].some((id) => !ids.has(id))) ctx.addIssue({ code: "custom", path: ["holidays"], message: "Default holidays cannot be removed" })
  })
}
