import { Temporal } from "@js-temporal/polyfill"
import { defaultBusinessHolidays } from "~/lib/business-holidays"
import { z } from "~/lib/zod"
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
  date: z.string().refine((value) => { try { Temporal.PlainDate.from(value); return /^\d{4}-\d{2}-\d{2}$/.test(value) } catch { return false } }),
  enabled: z.boolean(),
  closed: z.boolean(),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
}).superRefine((value, ctx) => {
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
  const dates = new Map<string, boolean>()
  const ids = new Set<string>()
  const defaults = defaultBusinessHolidays(2026).map((holiday) => holiday.id)
  value.holidays.forEach((holiday, index) => {
    if (ids.has(holiday.id)) ctx.addIssue({ code: "custom", path: ["holidays", index, "name"], message: "Choose each holiday once" })
    ids.add(holiday.id)
    if (!holiday.id.startsWith("custom-") && (!defaults.includes(holiday.id) || holiday.name !== "")) ctx.addIssue({ code: "custom", path: ["holidays", index, "name"], message: "Default holiday names cannot be changed" })
    if (holiday.enabled && dates.has(holiday.date) && (holiday.id.startsWith("custom-") || dates.get(holiday.date))) ctx.addIssue({ code: "custom", path: ["holidays", index, "date"], message: "There is already a holiday on this date" })
    if (holiday.enabled) dates.set(holiday.date, holiday.id.startsWith("custom-"))
  })
  if (defaults.some((id) => !ids.has(id))) ctx.addIssue({ code: "custom", path: ["holidays"], message: "Default holidays cannot be removed" })
})
export type BusinessHolidayValues = z.infer<typeof businessHolidaySchema>
export type BusinessScheduleValues = z.infer<typeof businessScheduleSchema>
