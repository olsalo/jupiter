import { RoutePlaceholderSheet, PlaceholderSheetContent } from "~/components/placeholders/route-placeholder-sheet"

export const handle = { overlay: true }

export default function Availability() {
  return <RoutePlaceholderSheet titleKey="availability" returnTo="/calendar"><PlaceholderSheetContent /></RoutePlaceholderSheet>
}
