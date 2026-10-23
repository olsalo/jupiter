import type { AppLocale } from "~/lib/locale"

export type EmailLocale = AppLocale

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}
