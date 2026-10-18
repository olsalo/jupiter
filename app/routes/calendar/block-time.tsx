import { RoutePlaceholderSheet, PlaceholderSheetContent } from "~/components/placeholders/route-placeholder-sheet"

export const handle = { overlay: true }

export default function BlockTime() {
  return <RoutePlaceholderSheet titleKey="newBlockedTime" returnTo="/calendar"><PlaceholderSheetContent /></RoutePlaceholderSheet>
}
