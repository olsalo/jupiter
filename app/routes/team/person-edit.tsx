import { useLocation, useNavigate, useOutletContext } from "react-router"
import { TeamPersonForm } from "~/components/team/team-person-form"
import type { TeamPersonContext } from "~/components/team/team-types"
import { ResponsiveSheetPanel } from "~/components/overlays/responsive-sheet"
import { Alert, AlertTitle } from "~/components/ui/alert"
import { useTranslation } from "react-i18next"

export const handle = { teamMode: "edit" }
export function loader() {
  return null
}

export function clientLoader() {
  return null
}

export default function EditPerson() {
  const { t } = useTranslation("team")
  const { person, canManage, onPendingChange, sideNavigation } = useOutletContext<TeamPersonContext>()
  const location = useLocation()
  const navigate = useNavigate()
  if (!canManage) return <ResponsiveSheetPanel><Alert variant="info"><AlertTitle>{t("people.readOnly")}</AlertTitle></Alert></ResponsiveSheetPanel>
  if (!person) return null
  return <TeamPersonForm person={person} close={() => navigate("..", { relative: "path", replace: true, state: location.state })} onPendingChange={onPendingChange} sideNavigation={Boolean(sideNavigation)} />
}
