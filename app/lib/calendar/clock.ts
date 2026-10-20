export function subscribeCalendarClock(onChange: (now: Date) => void) {
  let timeout: ReturnType<typeof setTimeout>
  const update = () => {
    const now = Date.now()
    onChange(new Date(now))
    timeout = setTimeout(update, 60_000 - now % 60_000)
  }
  update()
  return () => clearTimeout(timeout)
}

export function isCalendarCurrentTimeVisible(minute: number, startMinute: number, endMinute: number) {
  return minute >= startMinute + 5 && minute <= endMinute - 5
}
