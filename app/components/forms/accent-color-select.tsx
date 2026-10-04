import type { Ref } from "react"
import { useTranslation } from "react-i18next"

import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "~/components/ui/select"
import { formAccentColors } from "~/lib/forms/form-accent-colors"

type AccentColorSelectProps = {
  disabled: boolean
  inputRef?: Ref<HTMLButtonElement>
  invalid: boolean
  label: string
  name?: string
  onBlur?: () => void
  onChange: (value: string | null) => void
  value: string | null
}

export function AccentColorSelect({ disabled, inputRef, invalid, label, name, onBlur, onChange, value }: AccentColorSelectProps) {
  const { t } = useTranslation("forms")
  const selectedValue = value?.toLowerCase() ?? "DEFAULT"
  const items: { value: string, color: string | null, label: string }[] = [
    { value: "DEFAULT", color: null, label: t("settings.colors.default") },
    ...formAccentColors.map(({ name, color }) => ({ value: color, color, label: t(`settings.colors.${name}`) })),
  ]
  // Keep previously saved colors available without silently replacing them.
  if (value && !items.some((item) => item.value === selectedValue)) {
    items.push({ value: selectedValue, color: value, label: t("settings.colors.custom") })
  }
  const selected = items.find((item) => item.value === selectedValue)!

  return (
    <Select disabled={disabled} items={items} name={name} onValueChange={(next) => {
      if (next) onChange(next === "DEFAULT" ? null : next)
    }} value={selectedValue}>
      <SelectTrigger aria-invalid={invalid || undefined} aria-label={label} onBlur={onBlur} ref={inputRef}>
        <SelectValue><ColorLabel color={selected.color} label={selected.label} /></SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            <ColorLabel color={item.color} label={item.label} />
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  )
}

function ColorLabel({ color, label }: { color: string | null, label: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span aria-hidden="true" className="size-3 shrink-0 rounded-full border border-foreground/10" style={{ backgroundColor: color ?? "var(--primary)" }} />
      <span className="truncate">{label}</span>
    </span>
  )
}
