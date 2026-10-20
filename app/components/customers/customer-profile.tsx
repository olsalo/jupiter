import { useTranslation } from "react-i18next"
import { Link, useLocation, useSearchParams } from "react-router"

import { CopyableContact } from "~/components/copyable-contact"
import Icon from "~/components/icons"
import { ResponsiveSheetPanel } from "~/components/responsive-sheet"
import { SettingsSectionHeader } from "~/components/settings-section-header"
import { Button } from "~/components/ui/button"
import { Tabs, TabsList, TabsPanel, TabsTab } from "~/components/ui/tabs"
import { UserAvatar } from "~/components/user-avatar"
import { useOrganizationPermission } from "~/lib/use-organization-access"
import { CustomerAppointments } from "./customer-appointments"
import { customerName, type Customer } from "./customer-types"

export function CustomerProfile({ customer }: { customer: Customer }) {
  const { t } = useTranslation()
  const location = useLocation()
  const canUpdate = useOrganizationPermission({ customers: ["update"] })
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get("customerTab")
  const tab = requestedTab === "appointments" ? "appointments" : "overview"
  const name = customerName(customer)
  const details = [
    { label: t("customerPage.firstName"), value: customer.firstName },
    { label: t("customerPage.lastName"), value: customer.lastName || "—" },
    { label: t("customerPage.email"), value: customer.email ? <CopyableContact kind="email" value={customer.email} /> : "—" },
    { label: t("customerPage.phone"), value: customer.phone ? <CopyableContact kind="phone" value={customer.phone} /> : "—" },
  ]

  return <Tabs className="min-h-0 flex-1 gap-0" value={tab} onValueChange={(value) => {
    setSearchParams((params) => { params.set("customerTab", String(value)); return params }, { replace: true, state: location.state, preventScrollReset: true })
  }}>
    <div className="@container/customer-header shrink-0 border-b">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-6 pb-5 pt-10 sm:py-4.5">
        <UserAvatar className="size-14 text-lg" decorative={true} name={name} stableId={customer.id} />
        <h2 className="min-w-0 break-words text-xl font-semibold leading-7">{name}</h2>
        {canUpdate ? <Button aria-label={t("customerPage.edit")} className="@max-[32rem]/customer-header:size-8 @max-[32rem]/customer-header:p-0" render={<Link replace={true} state={location.state} to={`edit${location.search}`} />} type="button" variant="outline"><Icon aria-hidden={true} name="edit" size={16} /><span className="@max-[32rem]/customer-header:hidden">{t("customerPage.edit")}</span></Button> : null}
      </div>
      <div className="px-6"><TabsList aria-label={t("customerPage.details")} className="grid w-full grid-cols-2" variant="underline">{(["overview", "appointments"] as const).map((value) => <TabsTab key={value} value={value}><Icon aria-hidden={true} name={value === "overview" ? "user" : "calendar"} size={16} />{t(`customerPage.${value}`)}</TabsTab>)}</TabsList></div>
    </div>
    <TabsPanel className="flex min-h-0 flex-1 flex-col" value="overview">
      <div className="shrink-0 px-6 pb-5 pt-6"><SettingsSectionHeader title={t("customerPage.contact")} description={t("customerPage.contactDescription")} /></div>
      <ResponsiveSheetPanel className="px-6! pt-0! pb-6!" scrollFade={true}>
        <dl className="divide-y">{details.map((detail) => <div className="grid gap-1.5 py-4 text-sm sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center sm:gap-4" key={detail.label}><dt className="text-muted-foreground">{detail.label}</dt><dd className="min-w-0 whitespace-pre-wrap break-words">{detail.value}</dd></div>)}</dl>
        <div className="grid gap-6 border-t pt-6">
          <section className="grid gap-3" aria-label={t("customerPage.recentAppointment")}><h3 className="text-sm font-medium">{t("customerPage.recentAppointment")}</h3><CustomerAppointments customerId={customer.id} page={customer.appointments.recent} preview={true} scope="history" /></section>
        </div>
      </ResponsiveSheetPanel>
    </TabsPanel>
    <TabsPanel className="flex min-h-0 flex-1 flex-col" value="appointments">
      <ResponsiveSheetPanel className="flex flex-col gap-8 p-6!" scrollFade={true}>
        <section className="grid gap-4"><SettingsSectionHeader title={t("customerPage.upcoming")} description={t("customerPage.upcomingDescription")} /><CustomerAppointments customerId={customer.id} page={customer.appointments.upcoming} scope="upcoming" /></section>
        <section className="grid gap-4"><SettingsSectionHeader title={t("customerPage.history")} description={t("customerPage.historyDescription")} /><CustomerAppointments customerId={customer.id} page={customer.appointments.history} scope="history" /></section>
      </ResponsiveSheetPanel>
    </TabsPanel>
  </Tabs>
}
