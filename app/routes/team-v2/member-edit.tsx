import { useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Outlet, useLocation, useNavigate, useOutletContext } from "react-router"
import { ResponsiveSheetPanel } from "~/components/overlays/responsive-sheet"
import { TeamPersonForm } from "~/components/team/team-person-form"
import type { TeamPersonContext } from "~/components/team/team-types"
import { Alert, AlertTitle } from "~/components/ui/alert"

export const handle = { teamMode: "edit" }

export function loader() {
  return null
}

export function clientLoader() {
  // Client queries own fetching and freshness after the initial server render.
  return null
}

export default function EditMember() {
  const { t } = useTranslation("team")
  const { person: member, canManage, onPendingChange, sideNavigation } = useOutletContext<TeamPersonContext>()
  const location = useLocation()
  const navigate = useNavigate()
  const close = useCallback(() => { void navigate("..", { relative: "path", replace: true, state: location.state }) }, [navigate, location.state])

  return <>
    {!canManage ? <ResponsiveSheetPanel><Alert variant="info"><AlertTitle>{t("people.readOnly")}</AlertTitle></Alert></ResponsiveSheetPanel> : member ? <TeamPersonForm person={member} close={close} onPendingChange={onPendingChange} sideNavigation={Boolean(sideNavigation)} /> : null}
    <Outlet />
  </>
}
