import { useTranslation } from "react-i18next"
import { Link, useLocation, useSearchParams } from "react-router"

import Icon from "~/components/icons"
import { IconListItem } from "~/components/icon-list-item"
import { ResponsiveSheetPanel } from "~/components/responsive-sheet"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { UserAvatar } from "~/components/user-avatar"
import { Button } from "~/components/ui/button"
import { Tabs, TabsPanel } from "~/components/ui/tabs"
import { cn } from "~/lib/utils"
import { TeamPersonAbout } from "./team-person-about"
import { TeamPersonTimeOff } from "./team-person-time-off"
import { TeamPersonBreaks } from "./team-person-breaks"
import { TeamPersonAvailability } from "./team-person-availability"
import { TeamPersonNavigationLayout } from "./team-person-navigation-layout"
import { TeamPersonStatusBadges } from "./team-person-status-badges"
import { TeamPersonTabs } from "./team-person-tabs"
import type { TeamPerson } from "./team-types"

export function TeamPersonProfile({ person, canManage, sideNavigation = false }: { person: TeamPerson; canManage: boolean; sideNavigation?: boolean }) {
  const { t } = useTranslation("team")
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get("profileTab")
  const tab = requestedTab === "availability" || requestedTab === "services" || requestedTab === "breaks" || requestedTab === "time-off" ? requestedTab : "about"
  const editHref = tab === "about" || !person.staff ? "edit" : `edit?editTab=${tab}`
  const services = person.staff?.staffServices.filter((link) => link.isActive) ?? []

  return (
    <TeamPersonNavigationLayout enabled={sideNavigation} mode="view" value={tab}>
    <div className="flex min-h-0 flex-1 flex-col [&_[data-slot=scroll-area-content]]:flex [&_[data-slot=scroll-area-content]]:min-h-full [&_[data-slot=scroll-area-content]]:flex-col">
      <Tabs className="min-h-0 flex-1 gap-0" value={tab} onValueChange={(value) => setSearchParams((params) => {
        params.set("profileTab", String(value))
        return params
      }, { replace: true, state: location.state, preventScrollReset: true })}>
        <div className="@container/profile-header shrink-0 border-b" data-slot="person-profile-header">
          <div className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-6 pb-5 pt-10", sideNavigation && "sm:py-4.5")}>
            <UserAvatar className="size-14 text-lg" decorative={true} name={person.name} src={person.image} stableId={person.member?.user.id ?? person.id} />
            <div className="grid min-w-0 gap-2">
              <h2 className="break-words text-xl font-semibold leading-7">{person.name}</h2>
              <TeamPersonStatusBadges person={person} />
            </div>
            {canManage ? (
              <div className="flex max-w-32 flex-wrap justify-end gap-2">
                <Button aria-label={t("people.editProfile")} className="@max-[32rem]/profile-header:size-8 @max-[32rem]/profile-header:p-0" render={<Link to={editHref} replace={true} state={location.state} />} size="default" type="button" variant="outline">
                  <Icon aria-hidden={true} name="edit" size={16} />
                  <span className="@max-[32rem]/profile-header:hidden">{t("people.editProfile")}</span>
                </Button>
              </div>
            ) : null}
          </div>
          <div className={cn("min-w-0 px-6", sideNavigation && "@min-[80rem]/team:hidden")}>
            <TeamPersonTabs mode="view" disabled={false} />
          </div>
        </div>
        <ResponsiveSheetPanel className="flex grow shrink-0 flex-col p-0!" scrollFade={true}>
        <TabsPanel className="flex min-h-0 flex-col p-6" value="about"><TeamPersonAbout person={person} canManage={canManage} /></TabsPanel>
        <TabsPanel className="flex min-h-0 flex-col p-6" value="services">
          <div className="grid gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0"><h3 className="text-sm font-medium">{t("people.services")}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("people.profileServicesDescription")}</p></div>
            </div>
            {services.length ? <ul className="flex flex-col gap-3">{services.map((link) => <IconListItem icon="forms" iconClassName="size-8" key={link.id}><span className="min-w-0 break-words text-sm font-medium">{link.service.name}</span></IconListItem>)}</ul> : <Alert><AlertTitle>{t(person.staff ? "people.noServices" : "people.notBookable")}</AlertTitle><AlertDescription>{t(person.staff ? "people.noServicesDescription" : "people.noStaffDescription")}</AlertDescription></Alert>}
          </div>
        </TabsPanel>
        <TabsPanel className="flex min-h-0 flex-col p-6" value="availability">
          {person.staff ? <TeamPersonAvailability staff={person.staff} /> : <Alert><AlertTitle>{t("people.notBookable")}</AlertTitle><AlertDescription>{t("people.noStaffDescription")}</AlertDescription></Alert>}
        </TabsPanel>
        <TabsPanel className="flex min-h-0 flex-col p-6" value="breaks">
          {person.staff ? <TeamPersonBreaks staff={person.staff} /> : <Alert><AlertTitle>{t("people.notBookable")}</AlertTitle><AlertDescription>{t("people.noStaffDescription")}</AlertDescription></Alert>}
        </TabsPanel>
        <TabsPanel className="flex min-h-0 flex-col p-6" value="time-off">
          {person.staff ? <TeamPersonTimeOff staff={person.staff} canManage={canManage} /> : <Alert><AlertTitle>{t("people.notBookable")}</AlertTitle><AlertDescription>{t("people.noStaffDescription")}</AlertDescription></Alert>}
        </TabsPanel>
        </ResponsiveSheetPanel>
      </Tabs>
    </div>
    </TeamPersonNavigationLayout>
  )
}
