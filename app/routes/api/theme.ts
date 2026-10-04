import { redirect } from "react-router"

import type { Route } from "./+types/theme"
import { themeCookie } from "~/lib/cookies.server"
import { defaultTheme, isTheme } from "~/lib/theme"

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const theme = formData.get("theme")
  const nextTheme = isTheme(theme) ? theme : defaultTheme
  const settingsHash = getSettingsHash(formData.get("settingsHash"))

  return redirect(getRedirectPath(request, settingsHash), {
    headers: {
      "Set-Cookie": await themeCookie.serialize(nextTheme),
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
