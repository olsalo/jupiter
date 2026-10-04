import {
  getFormatPreferenceFromCountry,
  getFormatPreferenceFromHeaders,
  type FormatPreference,
} from "./format-preference"
import { getIpLocationFromHeaders } from "./ip-location.server"

export async function getFormatPreferenceFromRequest(
  headers: Headers,
): Promise<FormatPreference> {
  const ipLocation = await getIpLocationFromHeaders(headers)

  if (ipLocation) {
    return getFormatPreferenceFromCountry(ipLocation.location.country)
  }

  return getFormatPreferenceFromHeaders(headers)
}
