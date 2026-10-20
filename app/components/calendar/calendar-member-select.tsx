import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { useCalendarBookingPreview } from "~/components/calendar/calendar-booking-preview"
import { useCalendarState } from "~/components/calendar/use-calendar-state"
import { Badge } from "~/components/ui/badge"
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Skeleton } from "~/components/ui/skeleton"

export function CalendarMemberSelect({ mobile }: { mobile?: boolean }) {
  const { t } = useTranslation()
  const { bookableMembers, selectedMember, staff, organization, setSearchParams, isMobile } = useCalendarState({ mobile })
  const { setPreview } = useCalendarBookingPreview()
  const ownMember = organization.data?.memberId ? bookableMembers.find((member) => member.memberId === organization.data?.memberId) : undefined
  const items = [...(isMobile ? [] : [{ value: "all", label: t("calendarControls.allMembers") }]), ...bookableMembers.map((member) => ({ value: member.id, label: member.name }))]
  const isLoading = staff.isPending || organization.isPending

  const renderLabel = (value: string, label: string) => value === ownMember?.id ? <span className="flex min-w-0 items-center gap-2">
    <span className="truncate">{label}</span>
    <Badge size="sm" variant="secondary">{t("team:youBadge")}</Badge>
  </span> : label

  return <div aria-busy={isLoading} className="w-full min-w-0" data-slot="calendar-member-select">
    <Select disabled={isLoading || items.length === 0} items={items} onValueChange={(value) => {
      if (value === null || (isMobile && value === "all")) return
      setPreview(null)
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous)
        next.delete("scope")
        if (value === "all") next.delete("member")
        else next.set("member", value)
        return next
      }, { replace: true, preventScrollReset: true })
    }} value={selectedMember?.id ?? (isMobile ? null : "all")}>
      <SelectTrigger aria-label={t("calendarControls.member")} className="h-9 min-w-0">
        <Icon aria-hidden={true} className="size-4 shrink-0" name={selectedMember || isMobile ? "user" : "users"} />
        <SelectValue placeholder={t("calendarControls.member")}>{isLoading ? <Skeleton aria-label={t("loading")} className="h-4 w-24" /> : selectedMember ? renderLabel(selectedMember.id, selectedMember.name) : t(isMobile ? "calendarControls.member" : "calendarControls.allMembers")}</SelectValue>
      </SelectTrigger>
      <SelectPopup>{items.map((item) => <SelectItem key={item.value} value={item.value}>{renderLabel(item.value, item.label)}</SelectItem>)}</SelectPopup>
    </Select>
  </div>
}
