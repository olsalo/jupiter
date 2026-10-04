import { initReactI18next } from "react-i18next"
import { createI18nextMiddleware } from "remix-i18next"

import {
  fallbackLanguage,
  namespaces,
  resources,
  supportedLanguages,
} from "~/locales"
import { localeCookie } from "~/lib/cookies.server"

export { localeCookie }

export const [i18nextMiddleware, getLocale, getInstance] =
  createI18nextMiddleware({
    detection: {
      supportedLanguages: [...supportedLanguages],
      fallbackLanguage,
      cookie: localeCookie,
      order: ["cookie", "header"],
    },
    i18next: {
      resources,
      fallbackLng: fallbackLanguage,
      supportedLngs: [...supportedLanguages],
      defaultNS: "common",
      ns: [...namespaces],
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    },
    plugins: [initReactI18next],
  })
