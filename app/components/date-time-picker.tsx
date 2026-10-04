import { TZDate } from "react-day-picker"
import type { ComponentProps } from "react"

import { DatePicker } from "~/components/date-picker"
import { TimePicker } from "~/components/time-picker"
import { calendarDateToValue } from "~/lib/calendar-date"
import { cn } from "~/lib/utils"

type DateTimePickerProps = Omit<ComponentProps<typeof DatePicker>, "value" | "onChange" | "className"> & {
  defaultTime: string
  timeLabel: string
  value: string | null
  onChange: (value: string | null) => void
}

export function DateTimePicker({ defaultTime, timeLabel, value, onChange, ...props }: DateTimePickerProps) {
  const date = value ? new TZDate(new Date(value).getTime(), props.timeZone) : null
  const day = date ? calendarDateToValue(date) : null
  const time = date ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : defaultTime
  const change = (nextDay: string, nextTime: string) => {
    const [year, month, dayOfMonth] = nextDay.split("-").map(Number)
    const [hours, minutes] = nextTime.split(":").map(Number)
    onChange(new Date(new TZDate(year, month - 1, dayOfMonth, hours, minutes, props.timeZone).getTime()).toISOString())
  }

  return (
    <div className={cn("grid w-full gap-2", day && (props.formatPreference === "us" ? "grid-cols-[minmax(0,1fr)_7.5rem]" : "grid-cols-[minmax(0,1fr)_6.5rem]"))}>
      <DatePicker {...props} onChange={(nextDay) => nextDay ? change(nextDay, time) : onChange(null)} value={day} />
      {day ? (
        <TimePicker
          disabled={props.disabled ?? false}
          endTime="23:59"
          formatPreference={props.formatPreference}
          intervalMinutes={60}
          invalid={props.invalid}
          label={timeLabel}
          language={props.language}
          onBlur={props.onBlur}
          onChange={(nextTime) => change(day, nextTime)}
          startTime="00:00"
          value={time}
        />
      ) : null}
    </div>
  )
}
