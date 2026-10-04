import { redirect } from "react-router"

import type { Route } from "./+types/format-preference"
import { formatPreferenceCookie } from "~/lib/cookies.server"
import { isFormatPreference } from "~/lib/format-preference"

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const formatPreference = formData.get("formatPreference")
  const nextFormatPreference = isFormatPreference(formatPreference)
    ? formatPreference
    : "eu"
  const settingsHash = getSettingsHash(formData.get("settingsHash"))

  return redirect(getRedirectPath(request, settingsHash), {
    headers: {
      "Set-Cookie": await formatPreferenceCookie.serialize(nextFormatPreference),
    },
  })
}

export function loader({ request }: Route.LoaderArgs) {
  return redirect(getRedirectPath(request))
}

function getRedirectPath(request: Request, settingsHash = "") {
  const requestUrl = new URL(request.url)
  const referer = request.headers.get("referer")

  if (!referer) {
    return "/"
  }

  let refererUrl: URL

  try {
    refererUrl = new URL(referer)
  } catch {
    return "/"
  }

  if (refererUrl.origin !== requestUrl.origin) {
    return "/"
  }

  return `${refererUrl.pathname}${refererUrl.search}${settingsHash}`
}

function getSettingsHash(value: FormDataEntryValue | null) {
  return typeof value === "string" && isSettingsHash(value) ? value : ""
}

function isSettingsHash(value: string) {
  return /^#settings(?:\/(?:profile|notifications|appearance|billing))?$/.test(
    value,
  )
}
