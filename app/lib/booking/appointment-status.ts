export function canRescheduleAppointment(status: string) {
  return ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "NO_SHOW"].includes(status)
}

export const blockingAppointmentStatuses = ["PENDING", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"] as const

export function blocksAppointmentTime(status: string) {
  return blockingAppointmentStatuses.some((blockingStatus) => blockingStatus === status)
}
