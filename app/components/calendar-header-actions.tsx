import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router"

import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Menu, MenuLinkItem, MenuPopup, MenuTrigger } from "~/components/ui/menu"

export function CalendarHeaderActions() {
  const { t } = useTranslation()
  const location = useLocation()
  const isCreateOpen = location.pathname === "/calendar/new"
  const returnState = { returnTo: `/calendar${location.search}` }

  return <>
    <Menu>
      <MenuTrigger aria-label={t("calendarControls.actions")} render={<Button className="max-md:size-9 max-md:p-0" size="lg" type="button" variant="outline" />}>
        <Icon aria-hidden={true} className="md:hidden" name="dots" size={18} />
        <span className="hidden md:inline">{t("calendarControls.actions")}</span>
        <Icon aria-hidden={true} className="hidden md:block" name="chevronDown" size={16} />
      </MenuTrigger>
      <MenuPopup align="end" className="min-w-44" sideOffset={6}>
        <MenuLinkItem closeOnClick={true} render={<Link to={`/calendar/availability${location.search}`} state={returnState} />}><Icon aria-hidden={true} name="clock" size={16} />{t("calendarControls.editAvailability")}</MenuLinkItem>
        <MenuLinkItem closeOnClick={true} render={<Link to={`/calendar/block-time${location.search}`} state={returnState} />}><Icon aria-hidden={true} name="calendarOff" size={16} />{t("calendarControls.blockTime")}</MenuLinkItem>
        <MenuLinkItem closeOnClick={true} render={<Link to={`/calendar/extra-availability${location.search}`} state={returnState} />}><Icon aria-hidden={true} name="calendarEvent" size={16} />{t("calendarControls.extraAvailability")}</MenuLinkItem>
      </MenuPopup>
    </Menu>
    <Button aria-label={t("routeActions.newAppointment")} className="max-md:size-9 max-md:p-0" disabled={isCreateOpen} render={isCreateOpen ? undefined : <Link to={`/calendar/new${location.search}`} state={{ returnTo: `/calendar${location.search}` }} />} size="lg" type="button"><Icon aria-hidden={true} name="add" size={18} /><span className="hidden md:inline">{t("routeActions.newAppointment")}</span></Button>
  </>
}
