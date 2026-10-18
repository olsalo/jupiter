import { Outlet, useMatch } from "react-router"
import { RoutePlaceholderSheet } from "~/components/placeholders/route-placeholder-sheet"

export const handle = { overlay: true }

export default function Details() {
  const editing = useMatch("/services/:serviceId/edit")
  if (editing) return <Outlet />
  return <RoutePlaceholderSheet titleKey="service" returnTo="/services"><Outlet /></RoutePlaceholderSheet>
}
