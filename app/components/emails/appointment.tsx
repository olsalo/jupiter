import { Button, Link, Section, Text } from "react-email"
import { EmailLayout } from "./layout"
import type { EmailLocale } from "~/lib/email-templates/types"

export function AppointmentEmail({ locale, title, organizationName, services, time, bookingCode, bookingCodeLabel, rescheduleUrl, rescheduleLabel, managementUrl, managementLabel }: { locale: EmailLocale; title: string; organizationName: string; services: string; time: string; bookingCode: string; bookingCodeLabel: string; rescheduleUrl?: string; rescheduleLabel: string; managementUrl?: string; managementLabel: string }) {
  return <EmailLayout locale={locale} preview={`${title} · ${organizationName}`} title={title}>
    <Text style={{ color: "#57534e", fontSize: "16px", lineHeight: "26px" }}>{organizationName}</Text>
    <Section style={{ backgroundColor: "#f5f5f4", padding: "16px 20px", borderRadius: "12px" }}>
      <Text style={{ fontSize: "16px", fontWeight: 700 }}>{services}</Text>
      <Text style={{ fontSize: "16px" }}>{time}</Text>
    </Section>
    {rescheduleUrl ? (
      <Section style={{ marginTop: "20px" }}>
        <Button href={rescheduleUrl} style={{ backgroundColor: "#1c1917", color: "#ffffff", borderRadius: "8px", padding: "14px 24px", fontSize: "16px" }}>{rescheduleLabel}</Button>
      </Section>
    ) : null}
    {managementUrl ? <Text style={{ fontSize: "14px", marginTop: "20px" }}>
      <Link href={managementUrl} style={{ color: "#1c1917", textDecoration: "underline" }}>{managementLabel}</Link>
    </Text> : null}
    <Text style={{ color: "#78716c", fontSize: "14px" }}>{bookingCodeLabel}: {bookingCode}</Text>
  </EmailLayout>
}
