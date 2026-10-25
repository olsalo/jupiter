import { useTranslation } from "react-i18next"

import { calendarDurationStepMinutes, calendarMinDurationMinutes } from "~/lib/calendar/time-step"
import { getCalendarBookingDurationStep } from "~/lib/calendar/booking-duration-steps"
import FormLabel from "~/components/forms/form-label"
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput } from "~/components/ui/number-field"

export function BookingDurationField({ length, onLengthChange, disabled, lengthError, language, maxLength = 1440, minLength = calendarMinDurationMinutes, intervalMinutes = calendarDurationStepMinutes, serviceDurations }: {
  serviceDurations?: readonly number[]
  length: number | null
  onLengthChange: (value: number | null, source: "input" | "step" | "snap") => void
  disabled: boolean
  lengthError?: string
  language: "en" | "fi"
  minLength?: number
  intervalMinutes?: number
  maxLength?: number
}) {
  const { t } = useTranslation()

  return <FormLabel error={lengthError} errorPlacement="below" errorClassName="whitespace-normal" label={t("bookingForm.length")}>
    <NumberField disabled={disabled} format={{ maximumFractionDigits: 0, useGrouping: false }} locale={language} max={maxLength} min={minLength} onValueChange={(value, details) => {
      if (details.direction && length !== null) {
        const options = { maxDuration: maxLength, minDurationMinutes: minLength, intervalMinutes, serviceDurations }
        const next = getCalendarBookingDurationStep({ ...options, length, direction: details.direction })
        const snap = details.direction === 1 && next === maxLength && maxLength < 1440
        onLengthChange(next, snap ? "snap" : "step")
      } else onLengthChange(value === null ? null : Math.min(value, maxLength), "input")
    }} snapOnStep={false} smallStep={1} step={1} largeStep={1} value={length}>
      <NumberFieldGroup>
        <NumberFieldDecrement aria-label={t("bookingForm.shortenLength")} />
        <NumberFieldInput aria-invalid={Boolean(lengthError)} aria-label={t("bookingForm.length")} />
        <NumberFieldIncrement aria-label={t("bookingForm.extendLength")} />
      </NumberFieldGroup>
    </NumberField>
  </FormLabel>
}
