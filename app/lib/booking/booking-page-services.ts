export function getHiddenBookingPageServiceIds(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object" || !("hiddenServiceIds" in metadata)) return []
  return Array.isArray(metadata.hiddenServiceIds) ? metadata.hiddenServiceIds.filter((id): id is string => typeof id === "string") : []
}
