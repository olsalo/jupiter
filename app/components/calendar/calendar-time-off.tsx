import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { ResponsiveSheetPanel, ResponsiveSheetFooter } from "~/components/responsive-sheet"
import { TeamTimeOffDialog } from "~/components/team/team-time-off-dialog"
import { TeamUpcomingTimeOff } from "~/components/team/team-upcoming-time-off"
import { Button } from "~/components/ui/button"
import { ScrollArea } from "~/components/ui/scroll-area"

export function CalendarTimeOff({ staffMemberId, timezone, close, onBusyChange }: {
  staffMemberId: string
  timezone: string
  close: () => void
  onBusyChange: (busy: boolean) => void
}) {
  const { t } = useTranslation("team")
  const [open, setOpen] = useState(false)
  const [flow, setFlow] = useState(0)
  useEffect(() => { onBusyChange(open) }, [open, onBusyChange])
  useEffect(() => () => onBusyChange(false), [onBusyChange])

  return <>
    <ScrollArea fill={true}>
      <ResponsiveSheetPanel className="flex min-h-full flex-col" scrollable={false}>
        <TeamUpcomingTimeOff staffMemberId={staffMemberId} timezone={timezone} action={<Button onClick={() => { setFlow((version) => version + 1); setOpen(true) }} size="sm" type="button" variant="outline"><Icon aria-hidden={true} name="plus" size={16} />{t("timeOff.addTitle")}</Button>} />
      </ResponsiveSheetPanel>
    </ScrollArea>
    <ResponsiveSheetFooter><Button disabled={open} onClick={close} type="button" variant="ghost">{t("people.close")}</Button></ResponsiveSheetFooter>
    <TeamTimeOffDialog flow={flow} onOpenChange={setOpen} open={open} staffMemberId={staffMemberId} timezone={timezone} />
  </>
}
