import { startTransition, StrictMode } from "react"
import { hydrateRoot } from "react-dom/client"
import { HydratedRouter } from "react-router/dom"
import i18next from "i18next"
import { I18nextProvider, initReactI18next } from "react-i18next"

import {
  fallbackLanguage,
  namespaces,
  resources,
  supportedLanguages,
} from "~/locales"
import { configureZodI18n } from "~/lib/zod"

async function hydrate() {
  await i18next.use(initReactI18next).init({
    resources,
    lng: document.documentElement.lang || fallbackLanguage,
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
  })
  configureZodI18n(i18next.t.bind(i18next))

  startTransition(() => {
    hydrateRoot(
      document,
      <I18nextProvider i18n={i18next}>
        <StrictMode>
          <HydratedRouter />
        </StrictMode>
      </I18nextProvider>,
    )
  })
}

hydrate().catch((error: unknown) => {
  console.error(error)
})
