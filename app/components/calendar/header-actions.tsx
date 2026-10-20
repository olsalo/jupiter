import { useTranslation } from "react-i18next"
import { Link, useLocation, useMatches } from "react-router"

import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Menu, MenuLinkItem, MenuPopup, MenuTrigger } from "~/components/ui/menu"
import { useMediaQuery } from "~/lib/hooks"

export function CalendarHeaderActions() {
  const { t } = useTranslation()
  const location = useLocation()
  const matches = useMatches()
  const isOverlay = useMediaQuery("max-1024px")
  const isSidePanelOpen = !isOverlay && matches.some((match) =>
    match.id === "routes/calendar/new-appointment" || match.id === "routes/calendar/appointment-layout"
  )
  const returnState = { returnTo: `/calendar${location.search}` }

  return <>
    <Menu>
      <MenuTrigger aria-label={t("calendarControls.actions")} render={<Button className="max-md:size-9 max-md:p-0" size="lg" type="button" variant="outline" />}>
        <Icon aria-hidden={true} className="md:hidden" name="dots" size={18} />
        <span className="hidden md:inline">{t("calendarControls.actions")}</span>
        <Icon aria-hidden={true} className="hidden md:block" name="chevronDown" size={16} />
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-44" sideOffset={6}>
        <MenuLinkItem closeOnClick={true} render={<Link draggable={false} to={`/calendar/availability${location.search}`} state={returnState} />}><Icon aria-hidden={true} name="clock" size={16} />{t("calendarControls.editAvailability")}</MenuLinkItem>
      </MenuPopup>
    </Menu>
    <Button aria-label={t("routeActions.newAppointment")} className="max-md:size-9 max-md:p-0" disabled={isSidePanelOpen} render={isSidePanelOpen ? undefined : <Link draggable={false} to={`/calendar/new${location.search}`} state={returnState} />} size="lg" type="button"><Icon aria-hidden={true} name="add" size={18} /><span className="hidden md:inline">{t("routeActions.newAppointment")}</span></Button>
  </>
}
