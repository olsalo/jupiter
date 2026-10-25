import type { Ref } from "react"
import { useTranslation } from "react-i18next"
import FormLabel from "~/components/forms/form-label"
import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "~/components/ui/select"

export function BookingPageChoices({ name, label, description, items, value, onChange, onBlur, inputRef, error, disabled, ordered = false }: {
  name: string
  label: string
  description: string
  items: { id: string; name: string }[]
  value: string[]
  onChange: (value: string[]) => void
  onBlur: () => void
  inputRef: Ref<HTMLButtonElement>
  error?: string | null
  disabled: boolean
  ordered?: boolean
}) {
  const { t } = useTranslation()
  const options = items.map((item) => ({ value: item.id, label: item.name }))
  for (const id of value) if (!options.some((item) => item.value === id)) options.push({ value: id, label: t("adminBookingPage.unavailable") })
  const move = (index: number, direction: number) => {
    const next = [...value]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    const moved = next[index]
    next[index] = next[target]
    next[target] = moved
    onChange(next)
  }
  return <div className="space-y-3">
    <FormLabel label={label} description={description} error={error}>
      <Select multiple={true} items={options} value={value} onValueChange={onChange} name={name} disabled={disabled || options.length === 0}>
        <SelectTrigger ref={inputRef} onBlur={onBlur} aria-invalid={Boolean(error)}><SelectValue placeholder={t("adminBookingPage.all")} /></SelectTrigger>
        <SelectPopup>{options.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectPopup>
      </Select>
    </FormLabel>
    {ordered && value.length > 1 ? <ol className="divide-y">
      {value.map((id, index) => <li className="flex items-center gap-3 py-2" key={id}>
        <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">{index + 1}</span>
        <span className="min-w-0 flex-1 truncate text-sm">{options.find((item) => item.value === id)?.label}</span>
        <div className="flex gap-1">
          <Button aria-label={t("adminBookingPage.moveUp", { name: options.find((item) => item.value === id)?.label })} disabled={disabled || index === 0} onClick={() => move(index, -1)} size="icon-sm" type="button" variant="ghost"><Icon aria-hidden={true} name="chevronUp" size={16} /></Button>
          <Button aria-label={t("adminBookingPage.moveDown", { name: options.find((item) => item.value === id)?.label })} disabled={disabled || index === value.length - 1} onClick={() => move(index, 1)} size="icon-sm" type="button" variant="ghost"><Icon aria-hidden={true} name="chevronDown" size={16} /></Button>
        </div>
      </li>)}
    </ol> : null}
  </div>
}
