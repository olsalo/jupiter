import { useTranslation } from "react-i18next"

import Icon from "~/components/icons"
import { Badge } from "~/components/ui/badge"
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "~/components/ui/select"

export function BookingMemberFilter({ members, value, onChange, disabled, ownMemberId }: {
  members: { id: string; name: string }[]
  value: string | undefined
  onChange: (value: string | undefined) => void
  disabled: boolean
  ownMemberId?: string
}) {
  const { t } = useTranslation()
  const items = [
    { value: "all", label: t("calendarControls.allMembers") },
    ...members.map((member) => ({ value: member.id, label: member.name })),
  ]
  const renderLabel = (id: string, label: string) => id === ownMemberId ? <span className="flex min-w-0 items-center gap-2">
    <span className="truncate">{label}</span>
    <Badge size="sm" variant="secondary">{t("team:youBadge")}</Badge>
  </span> : label

  return <Select disabled={disabled || items.length === 0} items={items} onValueChange={(next) => {
    if (next !== null) onChange(next === "all" ? undefined : next)
  }} value={value ?? "all"}>
    <SelectTrigger aria-label={t("calendarControls.member")} className="mb-3 w-full">
      <Icon aria-hidden={true} name={value ? "user" : "users"} size={16} />
      <SelectValue>{value ? renderLabel(value, members.find((member) => member.id === value)?.name ?? "") : undefined}</SelectValue>
    </SelectTrigger>
    <SelectPopup>{items.map((item) => <SelectItem key={item.value} value={item.value}>{renderLabel(item.value, item.label)}</SelectItem>)}</SelectPopup>
  </Select>
}
