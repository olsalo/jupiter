import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { useAppContext } from "~/lib/use-app-context"
import Icon from "~/components/icons"
import { SettingsSectionHeader } from "~/components/settings-section-header"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Button } from "~/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty"
import { useTRPC } from "~/lib/trpc/client"
import { TeamPersonSection } from "./team-person-section"
import { TeamTimeOffList } from "./team-time-off-list"
import { TeamPanelLoading } from "./team-panel-loading"
import { TeamTimeOffDialog } from "./team-time-off-dialog"
import type { TeamPerson } from "./team-types"

export function TeamPersonTimeOff({ staff, canManage, self = false }: { self?: boolean; staff: NonNullable<TeamPerson["staff"]>; canManage: boolean }) {
  const { t } = useTranslation("team")
  const root = useAppContext()
  const trpc = useTRPC()
  const timeOff = useQuery(trpc.availability.getTimeOff.queryOptions({ staffMemberId: staff.id }))
  const [open, setOpen] = useState(false)
  const [flow, setFlow] = useState(0)
  const timezone = staff.timezone ?? root?.organizationTimezone ?? "Europe/Helsinki"
  function add() {
    setFlow((value) => value + 1)
    setOpen(true)
  }
  const addButton = <Button onClick={add} size="sm" type="button" variant="outline"><Icon aria-hidden={true} name="plus" size={16} />{t("timeOff.add")}</Button>

  const header = <div className="flex items-start justify-between gap-4">
    <SettingsSectionHeader title={t("timeOff.tab")} description={t("timeOff.description")} />
    {canManage ? addButton : null}
  </div>
  const content = <>
    {timeOff.isPending ? <TeamPanelLoading label={t("timeOff.loading")} /> : timeOff.isError ? (
      <Alert variant="error"><AlertTitle>{t("timeOff.loadError")}</AlertTitle><AlertDescription>{t("retryDescription")}</AlertDescription><AlertAction><Button disabled={timeOff.isFetching} onClick={() => void timeOff.refetch()} size="sm" type="button" variant="outline">{t("retry")}</Button></AlertAction></Alert>
    ) : timeOff.data.length === 0 ? (
      <Empty className="min-h-0 w-full border-0 bg-transparent">
        <EmptyHeader><EmptyMedia variant="icon"><Icon aria-hidden={true} name="calendarEvent" /></EmptyMedia><EmptyTitle>{t("timeOff.empty")}</EmptyTitle><EmptyDescription>{t(canManage ? "timeOff.emptyDescription" : "people.readOnly")}</EmptyDescription></EmptyHeader>
      </Empty>
    ) : (
      <TeamTimeOffList canManage={canManage} entries={timeOff.data} staffMemberId={staff.id} timezone={timezone} />
    )}
    {canManage ? <TeamTimeOffDialog self={self} flow={flow} onOpenChange={setOpen} open={open} staffMemberId={staff.id} timezone={timezone} /> : null}
  </>

  return self ? <div className="relative flex min-h-0 flex-1 flex-col gap-4">{header}<div className="relative flex min-h-0 flex-1 flex-col">{content}</div></div> : <TeamPersonSection loadingLabel={timeOff.isPending ? t("timeOff.loading") : undefined} header={header}>{content}</TeamPersonSection>
}
