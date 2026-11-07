type LocationForSelection = {
  id: string
  isActive: boolean
  createdAt?: Date
}

export function getPrimaryLocation<Location extends LocationForSelection>(
  locations: readonly Location[] | undefined,
  defaultLocationId?: string | null,
): Location | undefined {
  const active = locations?.filter((location) => location.isActive) ?? []
  return active.find((location) => location.id === defaultLocationId)
    ?? active.sort((first, second) =>
      (first.createdAt?.getTime() ?? 0) - (second.createdAt?.getTime() ?? 0)
      || first.id.localeCompare(second.id),
    )[0]
}
