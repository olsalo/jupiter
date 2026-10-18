import { Temporal } from "@js-temporal/polyfill"
import { z } from "zod"

const day = z.string().refine((value) => {
  try {
    Temporal.PlainDate.from(value)
    return /^\d{4}-\d{2}-\d{2}$/.test(value)
  } catch { return false }
}, "Choose a date")
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export function timeOffSchema(messages: { title: string
  end: string
  repeat: string
  date?: string } = { title: "Add a title", end: "End must be after start", repeat: "Choose a repeat end date on or after the start" }) {
  const date = z.string().refine((value) => day.safeParse(value).success, messages.date ?? "Choose a date")
  return z.object({
    title: z.string().trim().min(1, messages.title).max(120),
    startDate: date, endDate: date, allDay: z.boolean(),
    startTime: time, endTime: time,
    repeat: z.enum(["none", "weekly", "monthly", "yearly"]), repeatUntil: z.string(),
  }).superRefine((value, ctx) => {
    if (value.endDate < value.startDate || (!value.allDay && value.endDate === value.startDate && value.endTime <= value.startTime)) {
      ctx.addIssue({ code: "custom", path: [value.allDay ? "endDate" : "endTime"], message: messages.end })
    }
    if (value.repeat !== "none" && value.repeatUntil) {
      const result = day.safeParse(value.repeatUntil)
      if (!result.success || !day.safeParse(value.startDate).success || value.repeatUntil < value.startDate) {
        ctx.addIssue({ code: "custom", path: ["repeatUntil"], message: messages.repeat })
      }
    }
  })
}

export type TimeOffValues = z.infer<ReturnType<typeof timeOffSchema>>

export function readTimeOffRecurrence(value: unknown) {
  const result = timeOffSchema().safeExtend({ timezone: z.string().refine((value) => {
    try {
      Temporal.Now.zonedDateTimeISO(value)
      return true
    } catch { return false }
  }) }).safeParse(value)
  return result.success && result.data.repeat !== "none" ? result.data : null
}

export function timeOffIntervals(values: TimeOffValues, timezone: string, range?: { from: Date; to: Date }) {
  if (values.repeat !== "none" && !values.repeatUntil && !range) throw new Error("Indefinite repeats need a date range")
  const start = Temporal.PlainDate.from(values.startDate)
  const end = Temporal.PlainDate.from(values.endDate)
  const durationDays = start.until(end, { largestUnit: "days" }).days
  const localDate = (date: Date) => Temporal.Instant.fromEpochMilliseconds(+date).toZonedDateTimeISO(timezone).toPlainDate()
  const lastDate = range ? localDate(range.to) : Temporal.PlainDate.from(values.repeat === "none" ? values.startDate : values.repeatUntil)
  const firstDate = range ? localDate(range.from).subtract({ days: durationDays + 1 }) : start
  const elapsed = start.until(firstDate, { largestUnit: values.repeat === "yearly" ? "years" : values.repeat === "monthly" ? "months" : "days" })
  const firstIndex = values.repeat === "none" ? 0 : Math.max(0, (values.repeat === "yearly" ? elapsed.years : values.repeat === "monthly" ? elapsed.months : Math.floor(elapsed.days / 7)) - 1)
  const intervals: { startsAt: Date; endsAt: Date }[] = []
  for (let index = firstIndex; ; index++) {
    const offset = values.repeat === "yearly" ? { years: index } : values.repeat === "monthly" ? { months: index } : { weeks: index }
    const nextStart = start.add(offset)
    if (nextStart.toString() > lastDate.toString() || (index > 0 && values.repeat === "none") || (values.repeat !== "none" && values.repeatUntil && nextStart.toString() > values.repeatUntil)) break
    const nextEnd = nextStart.add({ days: durationDays + (values.allDay ? 1 : 0) })
    const interval = {
      startsAt: new Date(nextStart.toZonedDateTime({ timeZone: timezone, plainTime: values.allDay ? "00:00" : values.startTime }).epochMilliseconds),
      endsAt: new Date(nextEnd.toZonedDateTime({ timeZone: timezone, plainTime: values.allDay ? "00:00" : values.endTime }).epochMilliseconds),
    }
    if (!range || (interval.startsAt < range.to && interval.endsAt > range.from)) intervals.push(interval)
  }
  return intervals
}
