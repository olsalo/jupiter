import { makeZodI18nMap } from "@semihbou/zod-i18n-map"
import i18next, { type TFunction } from "i18next"
import { z } from "zod"

const zodNamespace = "zod"

export function configureZodI18n(t: TFunction = i18next.t.bind(i18next)) {
  z.config({
    customError: makeZodI18nMap({
      t,
      ns: zodNamespace,
      handlePath: false,
    }),
  })
}

configureZodI18n()

export { z, ZodError } from "zod"
