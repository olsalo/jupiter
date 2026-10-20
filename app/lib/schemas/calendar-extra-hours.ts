import { Temporal } from "@js-temporal/polyfill"
import { z } from "zod"
import { timeOffSchema } from "../team-time-off.ts"

export function extraHoursSchema(messages: { date: string; time: string; end: string }) {
  const fields = timeOffSchema({ title: "", end: messages.end, repeat: "", date: messages.date }).shape
  return z.object({
    date: fields.startDate,
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, messages.time),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, messages.time),
  }).superRefine((values, context) => {
    if (values.endTime <= values.startTime) context.addIssue({ code: "custom", path: ["endTime"], message: messages.end })
  })
}

export type ExtraHoursValues = z.infer<ReturnType<typeof extraHoursSchema>>

export function extraHoursInterval(values: ExtraHoursValues, timezone: string) {
  const date = Temporal.PlainDate.from(values.date)
  return {
    startsAt: new Date(date.toZonedDateTime({ timeZone: timezone, plainTime: values.startTime }).epochMilliseconds),
    endsAt: new Date(date.toZonedDateTime({ timeZone: timezone, plainTime: values.endTime }).epochMilliseconds),
  }
}
