import type { PersonFormFields } from "~/lib/schemas/team"

type Break = PersonFormFields["breaks"][number]

export function toggleBreakDay(rules: Break[], day: number, enabled: boolean, timezone: string, paused: Map<number, Break[]>) {
  if (!enabled) {
    paused.set(day, rules.filter((rule) => rule.dayOfWeek === day))
    return rules.filter((rule) => rule.dayOfWeek !== day)
  }
  const saved = paused.get(day)
  if (saved?.length) {
    paused.delete(day)
    return [...rules, ...saved]
  }
  if (rules.some((rule) => rule.dayOfWeek === day)) {
    return rules.map((rule) => rule.dayOfWeek === day ? { ...rule, isActive: true } : rule)
  }
  return [...rules, { dayOfWeek: day, startMinute: -1, endMinute: -1, timezone, isActive: true, validFrom: null, validUntil: null }]
}

export function breaksSnapshot(rules: Break[]) {
  return JSON.stringify(rules.map(({ dayOfWeek, startMinute, endMinute, timezone, isActive, validFrom, validUntil }) => ({ dayOfWeek, startMinute, endMinute, timezone, isActive, validFrom, validUntil })).sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute || a.endMinute - b.endMinute))
}

export function isBreakTimeAvailable(rule: Break, field: "startMinute" | "endMinute", minute: number, workingHours: PersonFormFields["workingHours"], otherBreaks: Break[]) {
  const start = field === "startMinute" ? minute : rule.startMinute >= 0 ? rule.startMinute : minute - 15
  const end = field === "endMinute" ? minute : rule.endMinute >= 0 ? rule.endMinute : minute + 15
  if (start < 0 || end > 1440 || end - start < 15) return false
  if (!workingHours.some((hours) => hours.isActive && hours.dayOfWeek === rule.dayOfWeek && start >= hours.startMinute && end <= hours.endMinute)) return false
  return !otherBreaks.some((other) => other.isActive && other.dayOfWeek === rule.dayOfWeek && other.startMinute >= 0 && other.endMinute > other.startMinute && start < other.endMinute && end > other.startMinute)
}
