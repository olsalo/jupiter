export type BookingAvailabilityIssue = "outsideWorkingHours" | "overlapsBreak"
export type BookingWindow = { start: number; end: number }

export function getBookingAvailabilityIssues({ startsAt, endsAt, status, workingWindows, breakWindows, now }: {
  startsAt: Date
  endsAt: Date
  status: string
  workingWindows: BookingWindow[]
  breakWindows: BookingWindow[]
  now: number
}): BookingAvailabilityIssue[] {
  if (+startsAt <= now || !["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"].includes(status)) return []
  const issues: BookingAvailabilityIssue[] = []
  let coveredUntil = +startsAt
  for (const window of [...workingWindows].sort((a, b) => a.start - b.start)) {
    if (window.end <= coveredUntil) continue
    if (window.start > coveredUntil) break
    coveredUntil = window.end
    if (coveredUntil >= +endsAt) break
  }
  if (coveredUntil < +endsAt) issues.push("outsideWorkingHours")
  if (breakWindows.some((window) => window.start < +endsAt && window.end > +startsAt)) issues.push("overlapsBreak")
  return issues
}
