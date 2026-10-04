export const formatPreferences = ["eu", "us"] as const

export type FormatPreference = (typeof formatPreferences)[number]

export const formatLocaleByPreference: Record<FormatPreference, string> = {
  eu: "fi-FI",
  us: "en-US",
}

export const defaultTimeZone = "Europe/Helsinki"

const usFormatCountryCodes = new Set([
  "AS",
  "BZ",
  "CA",
  "FM",
  "GU",
  "MH",
  "MP",
  "PR",
  "PW",
  "PH",
  "UM",
  "US",
  "VI",
])

export function getFormatLocale(formatPreference: FormatPreference) {
  return formatLocaleByPreference[formatPreference]
}

type FormatDateTimeOptions = {
  formatPreference: FormatPreference
  includeDate?: boolean
  includeTime?: boolean
  includeYear?: boolean
  language: "en" | "fi"
  timeZone?: string
}

export function createDateTimeFormatter(options: FormatDateTimeOptions) {
  return (value: Date | string) => formatDateTime(value, options)
}

export function formatRelativeDateTime(
  value: Date | string,
  options: FormatDateTimeOptions & { now?: Date },
) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  const now = options.now ?? new Date()
  const secondsAgo = (now.getTime() - date.getTime()) / 1000
  if (secondsAgo < -60 || secondsAgo >= 30 * 24 * 60 * 60) {
    return formatDateTime(date, { ...options, includeTime: false })
  }

  const relative = new Intl.RelativeTimeFormat(options.language, { numeric: "auto" })
  if (secondsAgo < 60) return relative.format(0, "second")
  if (secondsAgo < 60 * 60) return relative.format(-Math.floor(secondsAgo / 60), "minute")
  if (secondsAgo < 24 * 60 * 60) return relative.format(-Math.floor(secondsAgo / (60 * 60)), "hour")
  if (secondsAgo < 7 * 24 * 60 * 60) return relative.format(-Math.floor(secondsAgo / (24 * 60 * 60)), "day")
  return relative.format(-Math.floor(secondsAgo / (7 * 24 * 60 * 60)), "week")
}

export function formatDateTime(
  value: Date | string,
  {
    formatPreference,
    includeDate = true,
    includeTime = true,
    includeYear = true,
    language,
    timeZone,
  }: FormatDateTimeOptions,
) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  const dateLabel = includeDate
    ? formatDatePart(date, formatPreference, includeYear, timeZone)
    : null

  if (!includeTime) {
    return dateLabel ?? "-"
  }

  const timeLabel = new Intl.DateTimeFormat(
    formatPreference === "eu" ? "en-GB" : "en-US",
    {
      hour: "numeric",
      hour12: formatPreference === "us",
      hourCycle: formatPreference === "eu" ? "h23" : undefined,
      minute: "2-digit",
      timeZone,
    },
  ).format(date)

  if (!dateLabel) {
    return timeLabel
  }

  const timeConnector =
    formatPreference === "eu" && language === "fi" ? "klo" : "at"

  return `${dateLabel} ${timeConnector} ${timeLabel}`
}

function formatDatePart(
  date: Date,
  formatPreference: FormatPreference,
  includeYear: boolean,
  timeZone?: string,
) {
  if (formatPreference === "eu") {
    const dateParts = new Intl.DateTimeFormat("fi-FI", {
      day: "numeric",
      month: "numeric",
      timeZone,
      year: "numeric",
    }).formatToParts(date)
    const valueFor = (type: Intl.DateTimeFormatPartTypes) =>
      dateParts.find((part) => part.type === type)?.value ?? ""
    const day = valueFor("day")
    const month = valueFor("month")

    return includeYear
      ? `${day}.${month}.${valueFor("year")}`
      : `${day}.${month}.`
  }

  const dateParts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone,
    year: "numeric",
  }).formatToParts(date)
  const valueFor = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((part) => part.type === type)?.value ?? ""

  const monthAndDay = `${valueFor("month")} ${valueFor("day")}`

  return includeYear ? `${monthAndDay} ${valueFor("year")}` : monthAndDay
}

export function formatNumber(
  value: number,
  formatPreference: FormatPreference,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(
    getFormatLocale(formatPreference),
    options,
  ).format(value)
}

export function isFormatPreference(
  value: unknown,
): value is FormatPreference {
  return (
    typeof value === "string" &&
    formatPreferences.includes(value as FormatPreference)
  )
}

export function getFormatPreferenceFromHeaders(
  headers: Headers,
): FormatPreference {
  const country = getCountryCode(headers)

  if (country) {
    return getFormatPreferenceFromCountry(country)
  }

  const acceptedLanguages = headers.get("accept-language")?.toLowerCase() ?? ""

  return acceptedLanguages.includes("en-us") ? "us" : "eu"
}

export function getFormatPreferenceFromCountry(
  country: string | undefined,
): FormatPreference {
  return country && usFormatCountryCodes.has(country.toUpperCase())
    ? "us"
    : "eu"
}

function getCountryCode(headers: Headers) {
  const country = [
    headers.get("cf-ipcountry"),
    headers.get("x-vercel-ip-country"),
    headers.get("x-country-code"),
  ].find(Boolean)

  return country?.toUpperCase() ?? null
}
