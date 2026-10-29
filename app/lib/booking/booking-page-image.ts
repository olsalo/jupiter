export function getBookingPageImageKey(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || !("imageKey" in metadata)) return null
  return typeof metadata.imageKey === "string" ? metadata.imageKey : null
}

export function bookingPageImagePath(organizationSlug: string, pageSlug: string, key: string) {
  return `/api/booking-image/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(pageSlug)}?v=${encodeURIComponent(key)}`
}
