import { useTranslation } from "react-i18next"

import FormLabel from "~/components/form-label"
import Icon from "~/components/icons"
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { UserAvatar } from "~/components/user-avatar"
import type { BookingPageData } from "./booking-types"

type BookingMember = Pick<
  BookingPageData["staff"][number],
  "id" | "name" | "image"
>

function BookingMemberLabel({
  member,
  label,
}: {
  member?: BookingMember
  label: string
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {member ? (
        <UserAvatar
          className="size-6 shrink-0 text-[9px]"
          decorative={true}
          name={member.name}
          src={member.image}
          stableId={member.id}
        />
      ) : (
        <span
          aria-hidden={true}
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
        >
          <Icon aria-hidden={true} className="size-4" name="users" />
        </span>
      )}
      <span className="min-w-0 truncate leading-5">{label}</span>
    </span>
  )
}

export function BookingMemberSelect({
  members,
  value,
  onValueChange,
  disabled,
}: {
  members: BookingMember[]
  value?: string
  onValueChange: (value: string | undefined) => void
  disabled: boolean
}) {
  const { t } = useTranslation("booking")
  const items = [
    { value: "any", label: t("anyone") },
    ...members.map((member) => ({ value: member.id, label: member.name })),
  ]
  const selected = members.find((member) => member.id === value)

  return (
    <FormLabel label={t("staff")}>
      <Select
        disabled={disabled}
        items={items}
        onValueChange={(next) => {
          if (next !== null) onValueChange(next === "any" ? undefined : next)
        }}
        value={value ?? "any"}
      >
        <SelectTrigger className="min-h-11 w-full sm:min-h-9">
          <SelectValue className="min-w-0">
            <BookingMemberLabel
              label={selected?.name ?? t("anyone")}
              member={selected}
            />
          </SelectValue>
        </SelectTrigger>
        <SelectPopup>
          {items.map((item) => (
            <SelectItem
              className="min-h-12 py-2 sm:min-h-10 sm:py-1.5"
              key={item.value}
              value={item.value}
            >
              <BookingMemberLabel
                label={item.label}
                member={members.find((member) => member.id === item.value)}
              />
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </FormLabel>
  )
}
