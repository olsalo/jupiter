import { createElement } from "react"

import { OtpEmail } from "~/components/emails/otp"
import { renderEmail } from "./render"
import { getEmailTranslations } from "./translations"
import type { EmailLocale, EmailTemplate } from "./types"

export type OtpEmailType =
  | "sign-in"
  | "email-verification"
  | "forget-password"
  | "change-email"

interface OtpEmailTemplateOptions {
  expiresInMinutes: number
  locale: EmailLocale
  otp: string
  type: OtpEmailType
}

export function createOtpEmailTemplate({
  expiresInMinutes,
  locale,
  otp,
  type,
}: OtpEmailTemplateOptions): Promise<EmailTemplate> {
  const t = getEmailTranslations(locale)
  return renderEmail(t(`otp.${type}.subject`), createElement(OtpEmail, {
    locale,
    title: t(`otp.${type}.title`),
    intro: t(`otp.${type}.intro`),
    expiry: t("otpExpiry", { minutes: expiresInMinutes }),
    ignore: t("otpIgnore"),
    otp,
  }))
}
