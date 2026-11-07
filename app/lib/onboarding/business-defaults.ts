import { isOnboardingCountryCode } from "~/lib/localization/countries"
import type { IpLocation } from "~/lib/localization/ip-location.server"
import { getOnboardingTimezone, isOnboardingCurrency } from "~/lib/localization/onboarding"

const prefillFromIpLocation = true

const emptyLocationDefaults = { currency: "", location: "", timezone: "" }

type BusinessSettings = {
  currency: string
  countryCode: string | null
  timezone: string
}

export function getOnboardingBusinessDefaults({
  businessName,
  ipLocation,
  name,
  settings,
}: {
  businessName?: string
  ipLocation: IpLocation | null
  name: string
  settings?: BusinessSettings | null
}) {
  const ipCountry = ipLocation?.location.country?.toLowerCase()
  const ipDefaults = prefillFromIpLocation && (!ipCountry || isOnboardingCountryCode(ipCountry))
    ? {
        currency: ipLocation?.location.currency?.find(isOnboardingCurrency) ?? "",
        location: ipCountry ?? "",
        timezone: getOnboardingTimezone(ipLocation?.location.timezone) ?? "",
      }
    : emptyLocationDefaults

  return {
    businessName: businessName ?? "",
    currency: settings?.currency && isOnboardingCurrency(settings.currency) ? settings.currency : ipDefaults.currency,
    location: settings?.countryCode?.toLowerCase() ?? ipDefaults.location,
    name,
    timezone: getOnboardingTimezone(settings?.timezone) ?? ipDefaults.timezone,
  }
}
