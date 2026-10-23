export function canRescheduleAppointment(status: string) {
  return ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "NO_SHOW"].includes(status)
}
