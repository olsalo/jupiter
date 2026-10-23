import { createInstance } from "i18next"

import enEmail from "~/locales/en/email.json"
import fiEmail from "~/locales/fi/email.json"
import { fallbackLanguage } from "~/locales"
import type { AppLocale } from "~/lib/locale"

// Keep email translations independent of the active browser/request language
const emailI18n = createInstance()
await emailI18n.init({
  resources: { en: { email: enEmail }, fi: { email: fiEmail } },
  fallbackLng: fallbackLanguage,
  defaultNS: "email",
  initAsync: false,
  interpolation: { escapeValue: false },
})

export function getEmailTranslations(locale: AppLocale) {
  return emailI18n.getFixedT(locale, "email")
}
