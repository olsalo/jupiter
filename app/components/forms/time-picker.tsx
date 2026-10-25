import { useCallback, useMemo, type FocusEventHandler, type Ref } from "react"

import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "~/components/ui/select"
import { formatDateTime, type FormatPreference } from "~/lib/localization/format-preference"
import { createTimeOptions, type TimePickerRange } from "~/lib/forms/time-picker"
import { cn } from "~/lib/utils"

export type TimePickerProps = TimePickerRange & {
  className?: string
  disabled?: boolean
  disableTime?: (time: string) => boolean
  filterTime?: (time: string) => boolean
  formatPreference: FormatPreference
  id?: string
  inputRef?: Ref<HTMLButtonElement>
  invalid?: boolean
  label: string
  language: "en" | "fi"
  name?: string
  onBlur?: FocusEventHandler<HTMLButtonElement>
  onChange: (value: string) => void
  placeholder?: string
  /** Wall-clock time in 24-hour HH:mm format, independent of display preference. */
  value: string | null | undefined
}

export function TimePicker({
  className, disabled = false, disableTime, endTime = "23:59", filterTime, formatPreference, id,
  inputRef, intervalMinutes = 60, invalid = false, label, language, name,
  onBlur, onChange, placeholder = "--:--", startTime = "00:00", value,
}: TimePickerProps) {
  const formatTime = useCallback((time: string) => formatDateTime(`2000-01-01T${time}:00Z`, {
    formatPreference, includeDate: false, language, timeZone: "UTC",
  }), [formatPreference, language])
  const items = useMemo(() => createTimeOptions({ startTime, endTime, intervalMinutes }).filter((time) => !filterTime || filterTime(time)).map((time) => ({
    value: time,
    label: formatTime(time),
  })), [startTime, endTime, intervalMinutes, filterTime, formatTime])

  return (
    <Select disabled={disabled} items={items} name={name} onValueChange={(time) => { if (time) onChange(time) }} value={value ?? null}>
      <SelectTrigger
        aria-invalid={invalid || undefined}
        aria-label={label}
        className={cn("min-w-0 gap-1 px-2 text-sm tabular-nums", className)}
        id={id}
        onBlur={onBlur}
        ref={inputRef}
      >
        <SelectValue placeholder={placeholder}>{value ? formatTime(value) : undefined}</SelectValue>
      </SelectTrigger>
      <SelectPopup align="end" style={{ width: "var(--anchor-width)" }}>
        {items.map((item) => <SelectItem className="whitespace-nowrap text-sm tabular-nums" disabled={disableTime?.(item.value) ?? false} key={item.value} value={item.value}>{item.label}</SelectItem>)}
      </SelectPopup>
    </Select>
  )
}
