import { useQuery } from "@tanstack/react-query"
import { useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate, useRouteLoaderData, useSearchParams } from "react-router"

import type { loader as rootLoader } from "~/root"
import { CalendarWeeklyAvailability } from "~/components/calendar/calendar-weekly-availability"
import { CalendarTimeOff } from "~/components/calendar/calendar-time-off"
import { CalendarExtraHours } from "~/components/calendar/calendar-extra-hours"
import Icon from "~/components/icons"
import FormLabel from "~/components/form-label"
import { ResponsiveSheet, ResponsiveSheetPopup, ResponsiveSheetHeader, ResponsiveSheetTitle, ResponsiveSheetDescription, ResponsiveSheetPanel } from "~/components/responsive-sheet"
import { TeamPanelLoading } from "~/components/team/team-panel-loading"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Tabs, TabsList, TabsTab } from "~/components/ui/tabs"
import { useRouteSheet } from "~/components/use-route-sheet"
import { hasOrganizationPermission, isBookableStaff } from "~/lib/auth/permissions"
import { useTRPC } from "~/lib/trpc/client"
import { useCurrentOrganizationRole } from "~/lib/use-organization-access"

type ScheduleKind = "workingHours" | "breaks" | "timeOff" | "extraHours"

export function CalendarAvailability({ initialKind = "workingHours" }: { initialKind?: ScheduleKind }) {
  const { t } = useTranslation()
  const trpc = useTRPC()
  const root = useRouteLoaderData<typeof rootLoader>("root")
  const organizationRole = useCurrentOrganizationRole()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const organization = useQuery(trpc.organizations.getCurrent.queryOptions())
  const staff = useQuery(trpc.staff.list.queryOptions())
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("member"))
  const [kind, setKind] = useState<ScheduleKind>(initialKind)
  const [pending, setPending] = useState(false)
  const titleId = useId()
  const descriptionId = useId()
  const destination = useRef(typeof location.state?.returnTo === "string" && /^\/calendar(?:\?|$)/.test(location.state.returnTo) ? location.state.returnTo : `/calendar${location.search}`)
  const { open, version, close, finishClosing } = useRouteSheet({ onCloseComplete: () => { void navigate(destination.current, { replace: true }) } })
  const canManage = hasOrganizationPermission(organization.data?.role ?? organizationRole, { availability: ["manage"] })
  const members = (staff.data ?? []).filter(isBookableStaff)
  const own = members.find((member) => member.memberId === organization.data?.memberId)
  const selected = canManage ? members.find((member) => member.id === selectedId) ?? own ?? members[0] : own
  const items = members.map((member) => ({ value: member.id, label: member.name }))
  const loading = organization.isPending || staff.isPending
  const error = organization.isError || staff.isError
  const timezone = selected?.timezone ?? organization.data?.settings?.timezone ?? root?.organizationTimezone ?? "Europe/Helsinki"

  return <ResponsiveSheet deferClose={false} open={open} onOpenChange={(next) => { if (!next && !pending) close() }} onOpenChangeComplete={(next) => { if (!next) finishClosing() }}>
    <title>{t("routeTitles.availability")}</title>
    <ResponsiveSheetPopup className="sm:max-w-xl" drawerClassName="max-sm:h-[calc(100dvh-3rem)] max-sm:border-t max-sm:border-border" closeLabel={t("team:people.close")} descriptionId={descriptionId} open={open} side="right" titleId={titleId} variant="inset">
      <ResponsiveSheetHeader className="pb-3!">
        <ResponsiveSheetTitle id={titleId}>{t("routeTitles.availability")}</ResponsiveSheetTitle>
        <ResponsiveSheetDescription id={descriptionId}>{t("calendarAvailability.description")}</ResponsiveSheetDescription>
      </ResponsiveSheetHeader>
        <div className="grid gap-4 px-6 pb-4">
          {canManage ? <FormLabel label={t("calendarControls.member")}><Select disabled={loading || pending || items.length === 0} items={items} value={selected?.id ?? null} onValueChange={(value) => { if (value) setSelectedId(value) }}>
            <SelectTrigger aria-label={t("calendarControls.member")}><SelectValue placeholder={t("team:v2.selectMember")} /></SelectTrigger>
            <SelectPopup>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectPopup>
          </Select></FormLabel> : null}
        </div>
        <Tabs className="flex min-h-0 flex-1 flex-col gap-0" value={kind} onValueChange={(value) => setKind(value as ScheduleKind)}>
          <div className="shrink-0 px-6 pb-4"><TabsList className="grid w-full grid-cols-2 sm:flex">
            <TabsTab disabled={pending} value="workingHours"><Icon aria-hidden={true} name="clock" size={16} />{t("team:people.availability")}</TabsTab>
            <TabsTab disabled={pending} value="breaks"><Icon aria-hidden={true} name="coffee" size={16} />{t("team:people.breaks")}</TabsTab>
            <TabsTab disabled={pending} value="timeOff"><Icon aria-hidden={true} name="calendarOff" size={16} />{t("team:timeOff.tab")}</TabsTab>
            <TabsTab disabled={pending} value="extraHours"><Icon aria-hidden={true} name="calendarEvent" size={16} />{t("calendarExtraHours.tab")}</TabsTab>
          </TabsList></div>
          {loading ? <div className="relative min-h-0 flex-1"><TeamPanelLoading label={t("team:people.loadingAvailability")} /></div> : error ? <ResponsiveSheetPanel>
            <Alert variant="error"><AlertTitle>{t("team:people.availabilityError")}</AlertTitle><AlertDescription>{t("team:retryDescription")}</AlertDescription><AlertAction><Button disabled={organization.isFetching || staff.isFetching} onClick={() => void Promise.all([organization.refetch(), staff.refetch()])} type="button" variant="outline">{t("team:retry")}</Button></AlertAction></Alert>
          </ResponsiveSheetPanel> : selected ? <div className="flex min-h-0 flex-1 flex-col" key={`${selected.id}-${version}`}>
            {kind === "timeOff" ? <CalendarTimeOff staffMemberId={selected.id} timezone={timezone} close={close} onBusyChange={setPending} /> : kind === "extraHours" ? <CalendarExtraHours staffMemberId={selected.id} timezone={timezone} close={close} onBusyChange={setPending} /> : <CalendarWeeklyAvailability key={kind} staffMemberId={selected.id} kind={kind} onPendingChange={setPending} close={close} />}
          </div> : <ResponsiveSheetPanel><Alert><AlertTitle>{t("team:people.notBookable")}</AlertTitle><AlertDescription>{t("team:people.noStaffDescription")}</AlertDescription></Alert></ResponsiveSheetPanel>}
        </Tabs>
    </ResponsiveSheetPopup>
  </ResponsiveSheet>
}
