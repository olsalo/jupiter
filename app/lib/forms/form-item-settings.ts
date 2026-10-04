export function getSetting(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  return key in value ? value[key as keyof typeof value] : undefined
}

export function getAllowOther(settings: unknown) {
  return Boolean(
    settings &&
    typeof settings === "object" &&
    !Array.isArray(settings) &&
    "allowOther" in settings &&
    settings.allowOther,
  )
}
