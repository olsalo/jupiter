// Used only to parse relative paths, never as a redirect destination
const redirectParsingOrigin = "https://redirect.invalid"

export function getSafeRedirectTo(searchParams: URLSearchParams) {
  const redirectTo = searchParams.get("redirectTo")

  if (
    !redirectTo ||
    !redirectTo.startsWith("/") ||
    redirectTo.startsWith("//") ||
    /[\\\u0000-\u0020]/.test(redirectTo)
  ) {
    return "/"
  }

  const redirectUrl = new URL(redirectTo, redirectParsingOrigin)
  if (redirectUrl.origin !== redirectParsingOrigin || redirectUrl.pathname.startsWith("//")) {
    return "/"
  }
  let pathname = redirectUrl.pathname

  if (pathname === "/_.data") {
    pathname = "/"
  } else if (pathname.endsWith("/_.data")) {
    pathname = pathname.slice(0, -"_.data".length)
  } else if (pathname.endsWith(".data")) {
    pathname = pathname.slice(0, -".data".length)
  }

  try {
    if (decodeURIComponent(pathname).replace(/\/+$/, "").toLowerCase() === "/auth") return "/"
  } catch {
    return "/"
  }

  const redirectSearchParams = new URLSearchParams(redirectUrl.search)
  redirectSearchParams.delete("_routes")
  redirectSearchParams.delete("index")
  const search = redirectSearchParams.toString()

  return `${pathname}${search ? `?${search}` : ""}${redirectUrl.hash}`
}

export function getAfterOnboardingRedirect(searchParams: URLSearchParams, welcome = false) {
  const destination = new URL(getSafeRedirectTo(searchParams), redirectParsingOrigin)
  let pathname: string
  try {
    pathname = decodeURIComponent(destination.pathname).replace(/\/+$/, "").toLowerCase()
  } catch {
    pathname = "/onboarding"
  }
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) {
    destination.pathname = "/"
    destination.search = ""
    destination.hash = ""
  }
  if (welcome) destination.searchParams.set("welcome", "true")
  return `${destination.pathname}${destination.search}${destination.hash}`
}
