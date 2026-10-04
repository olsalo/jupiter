import { useState, type Ref } from "react"
import { enUS, fi } from "react-day-picker/locale"

import Icon from "~/components/icons"
import { Button } from "~/components/ui/button"
import { Calendar } from "~/components/ui/calendar"
import { Popover, PopoverPopup, PopoverTitle, PopoverTrigger } from "~/components/ui/popover"
import { calendarDateFromValue, calendarDateToValue } from "~/lib/forms/form-closing-date"
import { formatDateTime, type FormatPreference } from "~/lib/format-preference"
import { cn } from "~/lib/utils"

type DatePickerProps = {
  className?: string
  clearLabel: string
  disabled: boolean
  formatPreference: FormatPreference
  inputRef?: Ref<HTMLButtonElement>
  invalid: boolean
  label: string
  language: "en" | "fi"
  onBlur?: () => void
  onChange: (value: string | null) => void
  placeholder: string
  timeZone: string
  value: string | null | undefined
}

export function DatePicker({ className, clearLabel, disabled, formatPreference, inputRef, invalid, label, language, onBlur, onChange, placeholder, timeZone, value }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = value ? calendarDateFromValue(value, timeZone) : undefined

  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger
          aria-invalid={invalid || undefined}
          aria-label={label}
          className={cn("w-full justify-start aria-invalid:border-destructive/36 focus-visible:aria-invalid:border-destructive/64 focus-visible:aria-invalid:ring-destructive/16 dark:aria-invalid:ring-destructive/24", value && "pr-9")}
          disabled={disabled}
          onBlur={onBlur}
          ref={inputRef}
          render={<Button type="button" variant="outline" />}
        >
          <Icon aria-hidden="true" name="calendar" size={16} />
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {selected ? formatDateTime(selected, { formatPreference, language, timeZone, includeTime: false }) : placeholder}
          </span>
        </PopoverTrigger>
        <PopoverPopup align="start">
          <PopoverTitle className="sr-only">{label}</PopoverTitle>
          <Calendar
            defaultMonth={selected}
            disabled={disabled}
            locale={language === "fi" ? fi : enUS}
            mode="single"
            onSelect={(date) => {
              onChange(date ? calendarDateToValue(date) : null)
              setOpen(false)
            }}
            selected={selected}
            timeZone={timeZone}
            weekStartsOn={1}
          />
        </PopoverPopup>
      </Popover>
      {value ? (
        <Button aria-label={clearLabel} className="absolute right-1 top-1/2 -translate-y-1/2" disabled={disabled} onClick={() => onChange(null)} size="icon-xs" type="button" variant="ghost">
          <Icon aria-hidden="true" name="x" size={16} />
        </Button>
      ) : null}
    </div>
  )
}
