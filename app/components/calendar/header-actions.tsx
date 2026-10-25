import { useTranslation } from "react-i18next"
import { Link, useLocation, useMatches } from "react-router"

import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Menu, MenuLinkItem, MenuPopup, MenuTrigger } from "~/components/ui/menu"
import { useMediaQuery } from "~/lib/hooks"

const availabilityActions = [
  { tab: "workingHours", label: "team:people.availability", icon: "clock" },
  { tab: "breaks", label: "team:people.breaks", icon: "coffee" },
  { tab: "timeOff", label: "team:timeOff.tab", icon: "calendarOff" },
  { tab: "extraHours", label: "calendarExtraHours.tab", icon: "calendarEvent" },
] as const

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
        {availabilityActions.map((action) => {
          const params = new URLSearchParams(location.search)
          params.set("tab", action.tab)
          return <MenuLinkItem closeOnClick={true} key={action.tab} render={<Link draggable={false} to={`/calendar/availability?${params}`} state={returnState} />}><Icon aria-hidden={true} name={action.icon} size={16} />{t(action.label)}</MenuLinkItem>
        })}
      </MenuPopup>
    </Menu>
    <Button aria-label={t("routeActions.newAppointment")} className="max-md:size-9 max-md:p-0" disabled={isSidePanelOpen} render={isSidePanelOpen ? undefined : <Link draggable={false} to={`/calendar/new${location.search}`} state={returnState} />} size="lg" type="button"><Icon aria-hidden={true} name="add" size={18} /><span className="hidden md:inline">{t("routeActions.newAppointment")}</span></Button>
  </>
}
