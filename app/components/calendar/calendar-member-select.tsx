import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { UserAvatar } from "~/components/data-display/user-avatar"
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

  const renderLabel = (value: string, label: string) => {
    const member = bookableMembers.find((member) => member.id === value)

    return <span className="flex min-w-0 items-center gap-2.5">
      {member ? <UserAvatar
        className="size-5 shrink-0 text-[9px]"
        decorative={true}
        name={member.name}
        src={member.image}
        stableId={member.id}
      /> : <span aria-hidden={true} className="flex size-5 shrink-0 items-center justify-center rounded-full border border-black/8 bg-muted text-muted-foreground dark:border-white/10">
        <Icon aria-hidden={true} className="size-3" name={isMobile ? "user" : "users"} />
      </span>}
      <span className="min-w-0 truncate leading-5">{label}</span>
      {value === ownMember?.id ? <Badge className="shrink-0" size="sm" variant="secondary">{t("team:youBadge")}</Badge> : null}
    </span>
  }

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
        <SelectValue className="min-w-0" placeholder={t("calendarControls.member")}>{isLoading ? <Skeleton aria-label={t("loading")} className="h-4 w-24" /> : selectedMember ? renderLabel(selectedMember.id, selectedMember.name) : renderLabel("all", t(isMobile ? "calendarControls.member" : "calendarControls.allMembers"))}</SelectValue>
      </SelectTrigger>
      <SelectPopup>{items.map((item) => <SelectItem key={item.value} value={item.value}>{renderLabel(item.value, item.label)}</SelectItem>)}</SelectPopup>
    </Select>
  </div>
}
