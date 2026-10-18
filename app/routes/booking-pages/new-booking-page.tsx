import { RoutePlaceholderSheet, PlaceholderSheetContent } from "~/components/placeholders/route-placeholder-sheet"

export const handle = { overlay: true }

export default function New() {
  return <RoutePlaceholderSheet titleKey="newBookingPage" returnTo="/booking-pages"><PlaceholderSheetContent /></RoutePlaceholderSheet>
}
