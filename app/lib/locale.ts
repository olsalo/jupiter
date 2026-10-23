import { supportedLanguages } from "~/locales"

export type AppLocale = (typeof supportedLanguages)[number]

export function isSupportedLocale(locale: unknown): locale is AppLocale {
  return typeof locale === "string" && supportedLanguages.includes(locale as AppLocale)
}
