import { redirect } from "react-router"

import type { Route } from "./+types/locale"
import { auth } from "~/lib/auth/server"
import { fallbackLanguage, supportedLanguages } from "~/locales"
import { localeCookie } from "~/lib/cookies.server"
import { syncUserLocale } from "~/lib/locale.server"

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData()
  const locale = formData.get("locale")
  const nextLocale =
    typeof locale === "string" && isSupportedLocale(locale)
      ? locale
      : fallbackLanguage
  const settingsHash = getSettingsHash(formData.get("settingsHash"))

  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (session) {
    await syncUserLocale({ locale: nextLocale, userId: session.user.id })
  }

  return redirect(getRedirectPath(request, settingsHash), {
    headers: {
      "Set-Cookie": await localeCookie.serialize(nextLocale),
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
    return "/auth"
  }

  let refererUrl: URL

  try {
    refererUrl = new URL(referer)
  } catch {
    return "/auth"
  }

  if (refererUrl.origin !== requestUrl.origin) {
    return "/auth"
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

function isSupportedLocale(locale: string): locale is "en" | "fi" {
  return supportedLanguages.includes(locale as "en" | "fi")
}
