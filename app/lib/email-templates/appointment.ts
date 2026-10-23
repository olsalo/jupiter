import { createElement } from "react"

import { AppointmentEmail } from "~/components/emails/appointment"
import { formatDateTime, getFormatPreferenceFromCountry } from "~/lib/format-preference"
import { getEmailTranslations } from "./translations"
import { renderEmail } from "./render"
import type { EmailLocale, EmailTemplate } from "./types"

export type AppointmentEmailKind = "BOOKING_CONFIRMATION" | "CANCELLATION" | "RESCHEDULE" | "REMINDER"

interface AppointmentEmailTemplateOptions {
  kind: AppointmentEmailKind
  locale: EmailLocale
  organizationName: string
  services: string[]
  startsAt: Date
  timezone: string
  country: string
  bookingCode: string
  rescheduleUrl?: string
  managementUrl?: string
}

export function createAppointmentEmailTemplate({ kind, locale, organizationName, services, startsAt, timezone, country, bookingCode, rescheduleUrl, managementUrl }: AppointmentEmailTemplateOptions): Promise<EmailTemplate> {
  const t = getEmailTranslations(locale)
  const subject = t(`appointment.${kind}`)
  const time = formatDateTime(startsAt, { formatPreference: getFormatPreferenceFromCountry(country), language: locale, timeZone: timezone })
  return renderEmail(subject, createElement(AppointmentEmail, {
    locale,
    title: subject,
    organizationName,
    services: services.join(", "),
    time,
    bookingCode,
    bookingCodeLabel: t("appointment.bookingCode"),
    rescheduleUrl: kind === "CANCELLATION" ? undefined : rescheduleUrl,
    rescheduleLabel: t("appointment.reschedule"),
    managementUrl,
    managementLabel: t("appointment.view"),
  }))
}
