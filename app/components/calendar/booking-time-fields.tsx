import { useTranslation } from "react-i18next"

import FormLabel from "~/components/form-label"
import { TimePicker } from "~/components/time-picker"
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput } from "~/components/ui/number-field"
import type { FormatPreference } from "~/lib/format-preference"

export function BookingTimeFields({ startTime, length, availableStartTimes, onStartChange, onLengthChange, disabled, startDisabled, timeError, lengthError, formatPreference, language }: {
  startTime: string
  length: number | null
  availableStartTimes: Set<string>
  onStartChange: (value: string) => void
  onLengthChange: (value: number | null) => void
  disabled: boolean
  startDisabled: boolean
  timeError?: string
  lengthError?: string
  formatPreference: FormatPreference
  language: "en" | "fi"
}) {
  const { t } = useTranslation()

  return <div className="grid grid-cols-2 items-start gap-4">
    <FormLabel error={timeError} errorPlacement="below" errorClassName="whitespace-normal" label={t("bookingForm.start")}>
      <TimePicker disabled={disabled || startDisabled} disableTime={(time) => !availableStartTimes.has(time)} formatPreference={formatPreference} intervalMinutes={5} invalid={Boolean(timeError)} label={t("bookingForm.start")} language={language} onChange={onStartChange} value={startTime} />
    </FormLabel>
    <FormLabel error={lengthError} errorPlacement="below" errorClassName="whitespace-normal" label={t("bookingForm.length")}>
      <NumberField disabled={disabled} format={{ maximumFractionDigits: 0, useGrouping: false }} locale={language} max={1440} min={5} onValueChange={onLengthChange} smallStep={1} step={5} value={length}>
        <NumberFieldGroup>
          <NumberFieldDecrement aria-label={t("bookingForm.shortenLength")} />
          <NumberFieldInput aria-invalid={Boolean(lengthError)} aria-label={t("bookingForm.length")} />
          <NumberFieldIncrement aria-label={t("bookingForm.extendLength")} />
        </NumberFieldGroup>
      </NumberField>
    </FormLabel>
  </div>
}
