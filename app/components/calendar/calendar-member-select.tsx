import { useTranslation } from "react-i18next"

import { useCalendarBookingPreview } from "~/components/calendar/calendar-booking-preview"
import { useCalendarState } from "~/components/calendar/use-calendar-state"
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "~/components/ui/select"

export function CalendarMemberSelect() {
  const { t } = useTranslation()
  const { bookableMembers, selectedMember, staff, setSearchParams } = useCalendarState()
  const { setPreview } = useCalendarBookingPreview()
  const items = [{ value: "all", label: t("calendarControls.allMembers") }, ...bookableMembers.map((member) => ({ value: member.id, label: member.name }))]

  return <div className="w-56 min-w-0 shrink-0 max-sm:flex-1" data-slot="calendar-member-select">
    <Select disabled={staff.isPending} items={items} onValueChange={(value) => {
      if (value === null) return
      setPreview(null)
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous)
        next.delete("scope")
        if (value === "all") next.delete("member")
        else next.set("member", value)
        return next
      }, { replace: true, preventScrollReset: true })
    }} value={selectedMember?.id ?? "all"}>
      <SelectTrigger aria-label={t("calendarControls.member")} className="h-9 min-w-0"><SelectValue /></SelectTrigger>
      <SelectPopup>{items.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectPopup>
    </Select>
  </div>
}
