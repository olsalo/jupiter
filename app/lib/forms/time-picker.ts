export type TimePickerRange = {
  /** Inclusive start and end, in 24-hour HH:mm format, within the same day. */
  startTime?: string
  endTime?: string
  intervalMinutes?: number
}

export function createTimeOptions({ startTime = "00:00", endTime = "23:59", intervalMinutes = 60 }: TimePickerRange = {}) {
  if (!Number.isInteger(intervalMinutes) || intervalMinutes <= 0) {
    throw new Error("Time picker intervalMinutes must be a positive integer")
  }

  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  if (start > end) throw new Error("Time picker endTime must be at or after startTime")

  const values: string[] = []
  for (let minutes = start; minutes <= end; minutes += intervalMinutes) {
    values.push(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`)
  }
  return values
}

function timeToMinutes(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error("Time picker range must use 24-hour HH:mm values")
  }
  const [hours, minutes] = value.split(":").map(Number)
  return hours * 60 + minutes
}
