import { useOutletContext } from "react-router"
import { TeamPersonProfile } from "~/components/team/team-person-profile"
import type { TeamPersonContext } from "~/components/team/team-types"

export function loader() {
  return null
}

export function clientLoader() {
  // Client queries own fetching and freshness after the initial server render.
  return null
}

export default function PersonView() {
  const { person, canManage, sideNavigation } = useOutletContext<TeamPersonContext>()
  return person ? <TeamPersonProfile person={person} canManage={canManage} sideNavigation={Boolean(sideNavigation)} /> : null
}
