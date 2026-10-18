import { RoutePlaceholderSheet, PlaceholderSheetContent } from "~/components/placeholders/route-placeholder-sheet"

export const handle = { overlay: true }

export default function ExtraAvailability() {
  return <RoutePlaceholderSheet titleKey="newAvailabilityOverride" returnTo="/calendar"><PlaceholderSheetContent /></RoutePlaceholderSheet>
}
