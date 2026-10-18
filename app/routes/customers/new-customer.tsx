import { RoutePlaceholderSheet, PlaceholderSheetContent } from "~/components/placeholders/route-placeholder-sheet"

export const handle = { overlay: true }

export default function New() {
  return <RoutePlaceholderSheet titleKey="newCustomer" returnTo="/customers"><PlaceholderSheetContent /></RoutePlaceholderSheet>
}
