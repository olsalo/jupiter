import type { Ref } from "react"
import { useTranslation } from "react-i18next"
import FormLabel from "~/components/forms/form-label"
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "~/components/ui/select"

export function BookingPageChoices({ name, label, description, items, value, onChange, onBlur, inputRef, error, disabled }: {
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
}) {
  const { t } = useTranslation()
  const options = items.map((item) => ({ value: item.id, label: item.name }))
  for (const id of value) if (!options.some((item) => item.value === id)) options.push({ value: id, label: t("adminBookingPage.unavailable") })
  return <div className="space-y-3">
    <FormLabel label={label} description={description} error={error}>
      <Select multiple={true} items={options} value={value} onValueChange={onChange} name={name} disabled={disabled || options.length === 0}>
        <SelectTrigger ref={inputRef} onBlur={onBlur} aria-invalid={Boolean(error)}><SelectValue placeholder={t("adminBookingPage.all")} /></SelectTrigger>
        <SelectPopup>{options.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectPopup>
      </Select>
    </FormLabel>
  </div>
}
