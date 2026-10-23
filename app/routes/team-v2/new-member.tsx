import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router"
import { TeamPersonForm } from "~/components/team/team-person-form"
import { TeamPersonSheet } from "~/components/team/team-person-sheet"

export const handle = { overlay: true }

export function loader() {
  return null
}

export function clientLoader() {
  return null
}

export default function NewMember() {
  const { t } = useTranslation("team")
  const [pending, setPending] = useState(false)
  const location = useLocation()
  const returnTo = `${location.pathname.replace(/\/new\/?$/, "")}${location.search}`
  return <TeamPersonSheet basePath="/team" defaultReturnTo={returnTo} title={t("people.addTitle")} description={t("people.addDescription")} pending={pending}>{(close) => <TeamPersonForm close={close} onPendingChange={setPending} />}</TeamPersonSheet>
}
