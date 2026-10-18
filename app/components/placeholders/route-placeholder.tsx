import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Link, Outlet, useLocation } from "react-router"

import Icon, { type AppIconName } from "~/components/icons"
import { TablePage, TablePageHeader } from "~/components/table-page"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"

export type PlaceholderTitle = "calendar" | "appointments" | "customers" | "services" | "staff" | "availability" | "mySchedule" | "locations" | "bookingPages" | "appointment" | "customer" | "service" | "staffMember" | "location" | "bookingPage" | "newAppointment" | "editAppointment" | "rescheduleAppointment" | "newCustomer" | "editCustomer" | "newService" | "editService" | "serviceIntake" | "newStaffMember" | "editStaffMember" | "staffAvailability" | "newLocation" | "editLocation" | "newBookingPage" | "editBookingPage" | "newAvailabilityRule" | "editAvailabilityRule" | "newAvailabilityOverride" | "editAvailabilityOverride" | "newBlockedTime" | "publicBooking" | "bookingDetails" | "cancelBooking" | "rescheduleBooking"

export function PlaceholderBody({ icon = "calendar" }: { icon?: AppIconName }) {
  const { t } = useTranslation()
  return (
    <Card className="min-h-60 border-dashed shadow-none">
      <CardHeader className="justify-items-center gap-4 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl border bg-muted/50">
          <Icon aria-hidden={true} name={icon} size={24} />
        </div>
        <Badge variant="secondary">{t("routePlaceholders.comingSoon")}</Badge>
        <CardTitle render={<h2 />}>{t("routePlaceholders.title")}</CardTitle>
        <CardDescription className="max-w-sm leading-relaxed">{t("routePlaceholders.description")}</CardDescription>
      </CardHeader>
    </Card>
  )
}

export function RoutePlaceholder({ titleKey, icon, createTitleKey, children }: {
  titleKey: PlaceholderTitle
  icon: AppIconName
  createTitleKey?: PlaceholderTitle
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const location = useLocation()
  const title = t(`routeTitles.${titleKey}`)
  return (
    <TablePage>
      <title>{title}</title>
      <TablePageHeader
        title={title}
        actions={createTitleKey ? (
          <Button render={<Link to={`new${location.search}`} state={{ returnTo: `${location.pathname}${location.search}` }} />} type="button">
            <Icon aria-hidden={true} name="add" size={18} />
            {t(`routeActions.${createTitleKey}`)}
          </Button>
        ) : undefined}
      />
      <PlaceholderBody icon={icon} />
      {children}
      <Outlet />
    </TablePage>
  )
}
