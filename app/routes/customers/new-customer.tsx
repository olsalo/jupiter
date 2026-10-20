import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router"
import { CustomerForm } from "~/components/customers/customer-form"
import { CustomerSheet } from "~/components/customers/customer-sheet"

export const handle = { overlay: true }

export function loader() {
  return null
}

export function clientLoader() {
  return null
}

export default function NewCustomer() {
  const { t } = useTranslation()
  const [pending, setPending] = useState(false)
  const location = useLocation()
  const returnTo = `${location.pathname.replace(/\/new\/?$/, "")}${location.search}`
  return <CustomerSheet defaultReturnTo={returnTo} title={t("customerPage.add")} description={t("customerPage.addDescription")} pending={pending}>{(close) => <CustomerForm close={close} onPendingChange={setPending} />}</CustomerSheet>
}
