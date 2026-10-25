import { getSafeSettingsHash } from "~/lib/routing/settings-navigation"
import { redirect } from "react-router"

import type { Route } from "./+types/theme"
import { themeCookie } from "~/lib/http/cookies.server.ts"
import { defaultTheme, isTheme } from "~/lib/preferences/theme"

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const theme = formData.get("theme")
  const nextTheme = isTheme(theme) ? theme : defaultTheme
  const settingsHash = getSafeSettingsHash(formData.get("settingsHash"))

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
