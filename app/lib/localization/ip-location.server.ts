export type IpLocation = {
  ip: string
  location: {
    area?: number
    country?: string
    eu?: boolean
    country_name?: string
    country_native?: string
    continent?: string
    continent_name?: string
    capital?: string
    phone?: number[]
    currency?: string[]
    languages?: string[]
    latitude?: number
    longitude?: number
    timezone?: string
  }
}

export async function getIpLocationFromHeaders(
  headers: Headers,
): Promise<IpLocation | null> {
  if (process.env.NODE_ENV === "development") {
    return {
      ip: "82.203.166.234",
      location: {
        latitude: 60.1717,
        longitude: 24.9349,
        area: 200,
        country: "FI",
        eu: true,
        timezone: "Europe/Helsinki",
        country_name: "Finland",
        country_native: "Suomi",
        continent: "EU",
        continent_name: "Europe",
        capital: "Helsinki",
        phone: [358],
        currency: ["EUR"],
        languages: ["fi", "sv"],
      },
    }
  }

  return getIpLocation(getClientIp(headers))
}

export async function getIpLocation(ip: string | null): Promise<IpLocation | null> {
  const apiKey = process.env.LOCATION_API_KEY
  const locationApiUrl = process.env.LOCATION_API_URL

  if (!apiKey || !locationApiUrl || !ip) {
    return null
  }

  const url = new URL(locationApiUrl)
  url.searchParams.set("ip", ip)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 2000)

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      return null
    }

    const result: unknown = await response.json()

    return isIpLocation(result) ? result : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function getClientIp(headers: Headers) {
  const forwardedIp = headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim()

  return (
    [
      headers.get("cf-connecting-ip"),
      headers.get("x-real-ip"),
      forwardedIp,
      headers.get("x-client-ip"),
    ].find((value) => value?.trim()) ?? null
  )
}

function isIpLocation(value: unknown): value is IpLocation {
  if (!isRecord(value) || typeof value.ip !== "string") {
    return false
  }

  return (
    isRecord(value.location) &&
    (value.location.currency === undefined ||
      (Array.isArray(value.location.currency) &&
        value.location.currency.every((currency) => typeof currency === "string")))
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
