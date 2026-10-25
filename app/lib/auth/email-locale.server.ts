import { auth } from "~/lib/auth/server"
import { localeCookie } from "~/lib/http/cookies.server.ts"
import type { EmailLocale } from "~/lib/email-templates/types"
import { isSupportedLocale } from "~/lib/localization/locale"
import { fallbackLanguage } from "~/locales"

export async function getEmailLocale(request?: Request | Headers): Promise<EmailLocale> {
  const headers = request instanceof Headers ? request : request?.headers
  if (headers) {
    // Resolve the authenticated account, never an account guessed from the recipient
    const session = await auth.api.getSession({ headers })
    if (isSupportedLocale(session?.user.locale)) return session.user.locale
  }

  const cookieLocale = await localeCookie.parse(
    headers?.get("Cookie") ?? "",
  )

  if (isSupportedLocale(cookieLocale)) {
    return cookieLocale
  }

  const acceptedLocale = headers?.get("Accept-Language")

  if (acceptedLocale) {
    const language = acceptedLocale
      .split(",")
      .map((part, index) => {
        const [tag, ...parameters] = part.trim().split(";")
        const qualityParameter = parameters.find((parameter) =>
          parameter.trim().startsWith("q="),
        )

        return {
          index,
          language: tag?.split("-")[0]?.toLowerCase(),
          quality: qualityParameter ? Number(qualityParameter.split("=")[1]) : 1,
        }
      })
      .sort((left, right) => right.quality - left.quality || left.index - right.index)
      .map(({ language }) => language)
      .find(isSupportedLocale)

    if (language) {
      return language
    }
  }

  return fallbackLanguage
}
