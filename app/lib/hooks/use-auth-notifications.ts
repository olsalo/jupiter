import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router"

import { joinedTeamErrorStorageKey } from "~/lib/team/team-join"
import { toast } from "~/lib/toast"

export function useAuthNotifications() {
  const { t } = useTranslation("auth")
  const { t: tTeam } = useTranslation("team")
  const location = useLocation()

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const hasQueryMarker = searchParams.get("sessionExpired") === "1"
    const hasStorageMarker = window.sessionStorage.getItem("sessionExpiredToast") === "1"
    if (!hasQueryMarker && !hasStorageMarker) return

    window.sessionStorage.removeItem("sessionExpiredToast")
    if (hasQueryMarker) {
      searchParams.delete("sessionExpired")
      const search = searchParams.toString()
      window.history.replaceState(
        window.history.state,
        "",
        `${location.pathname}${search ? `?${search}` : ""}${location.hash}`,
      )
    }
    toast.error(t("toasts.sessionExpired"))
  }, [location.hash, location.pathname, location.search, t])

  useEffect(() => {
    const error = window.sessionStorage.getItem(joinedTeamErrorStorageKey)
    if (!error) return

    window.sessionStorage.removeItem(joinedTeamErrorStorageKey)
    toast.error(tTeam("accept.errorTitle"), tTeam(`accept.${error}`))
  }, [tTeam])
}
