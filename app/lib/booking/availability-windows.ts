type Window = { start: number; end: number }

export function subtractAvailabilityWindows<Period extends Window>(periods: Period[], openings: Window[]): Period[] {
  return openings.reduce<Period[]>((remaining, opening) => remaining.flatMap((period) => {
    if (opening.end <= period.start || opening.start >= period.end) return [period]
    return [
      { ...period, end: Math.min(period.end, opening.start) },
      { ...period, start: Math.max(period.start, opening.end) },
    ].filter((part) => part.end > part.start)
  }), periods)
}

// Personal schedules replace inherited hours only during their effective dates.
// Disabled rules still reserve that period so a closed week stays closed.
export function inheritAvailabilityWindows(inherited: Window[], ownRules: { windows: Window[]; validFrom?: number | null; validUntil?: number | null }[]): Window[] {
  return [
    ...subtractAvailabilityWindows(inherited, ownRules.map((rule) => ({ start: rule.validFrom ?? -Infinity, end: rule.validUntil ?? Infinity }))),
    ...ownRules.flatMap((rule) => rule.windows),
  ]
}
