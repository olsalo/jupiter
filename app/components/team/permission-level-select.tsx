import { useMemo, type ComponentProps } from "react"
import { useTranslation } from "react-i18next"

import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from "~/components/ui/select"

export type PermissionLevel = "member" | "admin"

type PermissionOption = { value: PermissionLevel; label: string; description: string }

type PermissionLevelSelectProps = {
  value: PermissionLevel
  onValueChange: (value: PermissionLevel) => void
  name?: string
  disabled?: boolean
  invalid?: boolean
  onBlur?: ComponentProps<typeof SelectTrigger>["onBlur"]
  ref?: ComponentProps<typeof SelectTrigger>["ref"]
}

export function PermissionLevelSelect({ value, onValueChange, name, disabled = false, invalid = false, onBlur, ref }: PermissionLevelSelectProps) {
  const { t } = useTranslation("team")
  const items = useMemo<PermissionOption[]>(() => [
    { value: "member" as const, label: t("roles.member"), description: t("invite.standardDescription") },
    { value: "admin" as const, label: t("roles.admin"), description: t("invite.adminDescription") },
  ], [t])
  return (
    <Select<PermissionOption>
      items={items}
      value={items.find((item) => item.value === value) ?? items[0]}
      onValueChange={(item) => { if (item) onValueChange(item.value) }}
      itemToStringValue={(item) => item.value}
      isItemEqualToValue={(item, selected) => item.value === selected.value}
      name={name}
      disabled={disabled}
    >
      <SelectTrigger aria-label={t("permissionLevel")} aria-invalid={invalid} className="py-2" onBlur={onBlur} ref={ref}>
        <SelectValue>
          {(item) => item ? <span className="flex min-w-0 flex-col text-start">
            <span className="truncate">{item.label}</span>
            <span className="truncate text-xs text-muted-foreground" title={item.description}>{item.description}</span>
          </span> : null}
        </SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {items.map((item) => <SelectItem key={item.value} value={item} className="py-2">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span>{item.label}</span>
            <span className="text-xs leading-relaxed text-muted-foreground">{item.description}</span>
          </span>
        </SelectItem>)}
      </SelectPopup>
    </Select>
  )
}
