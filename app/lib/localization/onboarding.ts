import { onboardingCountryCodes } from "./countries"
import { currencyItems } from "./currencies"

type OnboardingCountry = typeof onboardingCountryCodes[number]

// Timezones follow the IANA tz database country table (zone.tab).
const countryLocales = {
  at: {
    currency: "EUR",
    timezones: [
      "Europe/Vienna",
    ],
  },
  be: {
    currency: "EUR",
    timezones: [
      "Europe/Brussels",
    ],
  },
  bg: {
    currency: "EUR",
    timezones: [
      "Europe/Sofia",
    ],
  },
  hr: {
    currency: "EUR",
    timezones: [
      "Europe/Zagreb",
    ],
  },
  cy: {
    currency: "EUR",
    timezones: [
      "Asia/Nicosia",
      "Asia/Famagusta",
    ],
  },
  cz: {
    currency: "CZK",
    timezones: [
      "Europe/Prague",
    ],
  },
  dk: {
    currency: "DKK",
    timezones: [
      "Europe/Copenhagen",
    ],
  },
  ee: {
    currency: "EUR",
    timezones: [
      "Europe/Tallinn",
    ],
  },
  fi: {
    currency: "EUR",
    timezones: [
      "Europe/Helsinki",
    ],
  },
  fr: {
    currency: "EUR",
    timezones: [
      "Europe/Paris",
    ],
  },
  de: {
    currency: "EUR",
    timezones: [
      "Europe/Berlin",
      "Europe/Busingen",
    ],
  },
  gr: {
    currency: "EUR",
    timezones: [
      "Europe/Athens",
    ],
  },
  hu: {
    currency: "HUF",
    timezones: [
      "Europe/Budapest",
    ],
  },
  ie: {
    currency: "EUR",
    timezones: [
      "Europe/Dublin",
    ],
  },
  it: {
    currency: "EUR",
    timezones: [
      "Europe/Rome",
    ],
  },
  lv: {
    currency: "EUR",
    timezones: [
      "Europe/Riga",
    ],
  },
  lt: {
    currency: "EUR",
    timezones: [
      "Europe/Vilnius",
    ],
  },
  lu: {
    currency: "EUR",
    timezones: [
      "Europe/Luxembourg",
    ],
  },
  mt: {
    currency: "EUR",
    timezones: [
      "Europe/Malta",
    ],
  },
  nl: {
    currency: "EUR",
    timezones: [
      "Europe/Amsterdam",
    ],
  },
  pl: {
    currency: "PLN",
    timezones: [
      "Europe/Warsaw",
    ],
  },
  pt: {
    currency: "EUR",
    timezones: [
      "Europe/Lisbon",
      "Atlantic/Madeira",
      "Atlantic/Azores",
    ],
  },
  ro: {
    currency: "RON",
    timezones: [
      "Europe/Bucharest",
    ],
  },
  sk: {
    currency: "EUR",
    timezones: [
      "Europe/Bratislava",
    ],
  },
  si: {
    currency: "EUR",
    timezones: [
      "Europe/Ljubljana",
    ],
  },
  es: {
    currency: "EUR",
    timezones: [
      "Europe/Madrid",
      "Africa/Ceuta",
      "Atlantic/Canary",
    ],
  },
  se: {
    currency: "SEK",
    timezones: [
      "Europe/Stockholm",
    ],
  },
  is: {
    currency: "ISK",
    timezones: [
      "Atlantic/Reykjavik",
    ],
  },
  li: {
    currency: "CHF",
    timezones: [
      "Europe/Vaduz",
    ],
  },
  no: {
    currency: "NOK",
    timezones: [
      "Europe/Oslo",
    ],
  },
  au: {
    currency: "AUD",
    timezones: [
      "Australia/Lord_Howe",
      "Antarctica/Macquarie",
      "Australia/Hobart",
      "Australia/Melbourne",
      "Australia/Sydney",
      "Australia/Broken_Hill",
      "Australia/Brisbane",
      "Australia/Lindeman",
      "Australia/Adelaide",
      "Australia/Darwin",
      "Australia/Perth",
      "Australia/Eucla",
    ],
  },
  ca: {
    currency: "CAD",
    timezones: [
      "America/St_Johns",
      "America/Halifax",
      "America/Glace_Bay",
      "America/Moncton",
      "America/Goose_Bay",
      "America/Blanc-Sablon",
      "America/Toronto",
      "America/Iqaluit",
      "America/Atikokan",
      "America/Winnipeg",
      "America/Resolute",
      "America/Rankin_Inlet",
      "America/Regina",
      "America/Swift_Current",
      "America/Edmonton",
      "America/Cambridge_Bay",
      "America/Inuvik",
      "America/Vancouver",
      "America/Creston",
      "America/Dawson_Creek",
      "America/Fort_Nelson",
      "America/Whitehorse",
      "America/Dawson",
    ],
  },
  ch: {
    currency: "CHF",
    timezones: [
      "Europe/Zurich",
    ],
  },
  gb: {
    currency: "GBP",
    timezones: [
      "Europe/London",
    ],
  },
  nz: {
    currency: "NZD",
    timezones: [
      "Pacific/Auckland",
      "Pacific/Chatham",
    ],
  },
  us: {
    currency: "USD",
    timezones: [
      "America/New_York",
      "America/Detroit",
      "America/Kentucky/Louisville",
      "America/Kentucky/Monticello",
      "America/Indiana/Indianapolis",
      "America/Indiana/Vincennes",
      "America/Indiana/Winamac",
      "America/Indiana/Marengo",
      "America/Indiana/Petersburg",
      "America/Indiana/Vevay",
      "America/Chicago",
      "America/Indiana/Tell_City",
      "America/Indiana/Knox",
      "America/Menominee",
      "America/North_Dakota/Center",
      "America/North_Dakota/New_Salem",
      "America/North_Dakota/Beulah",
      "America/Denver",
      "America/Boise",
      "America/Phoenix",
      "America/Los_Angeles",
      "America/Anchorage",
      "America/Juneau",
      "America/Sitka",
      "America/Metlakatla",
      "America/Yakutat",
      "America/Nome",
      "America/Adak",
      "Pacific/Honolulu",
    ],
  },
} satisfies Record<OnboardingCountry, { currency: string, timezones: string[] }>

const currencyCodes = new Set(onboardingCountryCodes.map((code) => countryLocales[code].currency))
const timezones = [...new Set(onboardingCountryCodes.flatMap((code) => countryLocales[code].timezones))]

export const onboardingCurrencyItems = currencyItems.filter(({ value }) => currencyCodes.has(value))

export const onboardingTimezoneItems = timezones
  .sort((first, second) => first.localeCompare(second))
  .map((value) => ({ label: value, value }))

const timezoneAliases = new Map(timezones.map((zone) => [
  new Intl.DateTimeFormat("en", { timeZone: zone }).resolvedOptions().timeZone,
  zone,
]))

export function isOnboardingCurrency(value: string) {
  return currencyCodes.has(value)
}

export function getOnboardingTimezone(value: string | undefined) {
  if (!value) return undefined
  try {
    const canonical = new Intl.DateTimeFormat("en", { timeZone: value }).resolvedOptions().timeZone
    return timezoneAliases.get(canonical)
  } catch {
    return undefined
  }
}
