import { RollingNumber } from "@kitlangton/rolling-number/react"

import "@kitlangton/rolling-number/styles.css"

import { getFormatLocale } from "~/lib/format-preference"
import type { FormatPreference } from "~/lib/format-preference"

type RollingFormattedNumberProps = {
  value: number
  formatPreference: FormatPreference
}

export function RollingFormattedNumber({ value, formatPreference }: RollingFormattedNumberProps) {
  return (
    <RollingNumber
      animated={true}
      duration={500}
      locales={getFormatLocale(formatPreference)}
      value={value}
    />
  )
}
