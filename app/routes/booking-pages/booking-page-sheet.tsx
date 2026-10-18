import { Outlet } from "react-router"
import { RoutePlaceholderSheet } from "~/components/placeholders/route-placeholder-sheet"

export const handle = { overlay: true }

export default function Details() {
  return <RoutePlaceholderSheet titleKey="bookingPage" returnTo="/booking-pages"><Outlet /></RoutePlaceholderSheet>
}
