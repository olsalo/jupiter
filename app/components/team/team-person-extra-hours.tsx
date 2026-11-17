import { CalendarExtraHours } from "~/components/calendar/calendar-extra-hours"
import { useAppContext } from "~/lib/hooks/use-app-context"
import type { TeamPerson } from "./team-types"

export function TeamPersonExtraHours({ staff, canManage, onBusyChange }: {
  staff: NonNullable<TeamPerson["staff"]>
  canManage: boolean
  onBusyChange?: (busy: boolean) => void
}) {
  const root = useAppContext()
  const timezone = staff.timezone ?? root.organizationTimezone ?? "Europe/Helsinki"

  return <CalendarExtraHours canManage={canManage} embedded={true} onBusyChange={onBusyChange} staffMemberId={staff.id} timezone={timezone} />
}
