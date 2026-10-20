import { Temporal } from "@js-temporal/polyfill"

export function currentScheduleDate(timezone: string) {
  return new Date(Temporal.Now.plainDateISO(timezone).toZonedDateTime(timezone).epochMilliseconds)
}

export type ScheduleRule = {
  dayOfWeek: number
  startMinute: number
  endMinute: number
  timezone: string
  isActive: boolean
  validFrom?: Date | null
  validUntil?: Date | null
}

export function scheduleAt<Rule extends ScheduleRule>(rules: Rule[], at: Date) {
  return rules.filter((rule) => (!rule.validFrom || +rule.validFrom <= +at) && (!rule.validUntil || +rule.validUntil > +at))
}

// Remove a future version and reconnect the schedule on either side of it
export function removeScheduleAt(rules: ScheduleRule[], at: Date) {
  const removed = rules.filter((rule) => rule.validFrom && +rule.validFrom === +at)
  if (!removed.length) return rules
  const ends = removed.map((rule) => rule.validUntil ? +rule.validUntil : Infinity)
  const end = Math.max(...ends)
  return rules.filter((rule) => !rule.validFrom || +rule.validFrom !== +at).map((rule) => rule.validUntil && +rule.validUntil === +at
    ? { ...rule, validUntil: end === Infinity ? null : new Date(end) }
    : rule)
}

// Replace only the selected version, retaining history and later scheduled versions
export function replaceScheduleAt(rules: ScheduleRule[], replacement: ScheduleRule[], at: Date, timezone: string) {
  const next = rules.flatMap((rule) => rule.validFrom && +rule.validFrom > +at ? [+rule.validFrom] : []).sort((a, b) => a - b)[0]
  const validUntil = next === undefined ? null : new Date(next)
  const retained = rules.flatMap((rule) => {
    if (rule.validFrom && +rule.validFrom >= +at) return +rule.validFrom === +at ? [] : [rule]
    if (!rule.validUntil || +rule.validUntil > +at) return [{ ...rule, validUntil: at }]
    return [rule]
  })
  // Keep an explicit closed week so an empty personal schedule cannot inherit business hours
  const incoming = replacement.length ? replacement : Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, startMinute: 480, endMinute: 1080, isActive: false }))
  return [...retained, ...incoming.map((rule) => ({ ...rule, timezone, validFrom: at, validUntil }))]
}
