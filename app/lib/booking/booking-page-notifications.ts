export function showBookingNotifications(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return true
  return !("showRecentBookings" in metadata && metadata.showRecentBookings === false)
}
