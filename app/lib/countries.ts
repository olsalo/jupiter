import countries from "./files/countries.json"

export const euCountryCodes = [
  "at",
  "be",
  "bg",
  "hr",
  "cy",
  "cz",
  "dk",
  "ee",
  "fi",
  "fr",
  "de",
  "gr",
  "hu",
  "ie",
  "it",
  "lv",
  "lt",
  "lu",
  "mt",
  "nl",
  "pl",
  "pt",
  "ro",
  "sk",
  "si",
  "es",
  "se",
] as const

export const eeaCountryCodes = ["is", "li", "no"] as const

export const euAndEeaCountryCodes = [
  ...euCountryCodes,
  ...eeaCountryCodes,
] as const

export const additionalOnboardingCountryCodes = [
  "au",
  "ca",
  "ch",
  "gb",
  "nz",
  "us",
] as const

export const onboardingCountryCodes = [
  ...euAndEeaCountryCodes,
  ...additionalOnboardingCountryCodes,
] as const

const euAndEeaCountryCodeSet = new Set<string>(euAndEeaCountryCodes)
const onboardingCountryCodeSet = new Set<string>(onboardingCountryCodes)

export const euAndEeaCountries = countries
  .filter(({ code }) => euAndEeaCountryCodeSet.has(code))
  .sort((first, second) => first.name.localeCompare(second.name))

export const onboardingCountries = countries
  .filter(({ code }) => onboardingCountryCodeSet.has(code))
  .sort((first, second) => first.name.localeCompare(second.name))

export function isEuOrEeaCountryCode(value: string) {
  return euAndEeaCountryCodeSet.has(value.toLowerCase())
}

export function isOnboardingCountryCode(value: string) {
  return onboardingCountryCodeSet.has(value.toLowerCase())
}
