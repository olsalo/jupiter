import { Section, Text } from "react-email"
import { EmailLayout } from "./layout"
import type { EmailLocale } from "~/lib/email-templates/types"

export function OtpEmail({ locale, title, intro, expiry, ignore, otp }: { locale: EmailLocale; title: string; intro: string; expiry: string; ignore: string; otp: string }) {
  return <EmailLayout locale={locale} preview={title} title={title}>
    <Text style={{ color: "#57534e", fontSize: "16px", lineHeight: "26px" }}>{intro} {expiry}</Text>
    <Section style={{ margin: "28px 0", padding: "18px", borderRadius: "12px", backgroundColor: "#f5f5f4", textAlign: "center" }}>
      <Text style={{ margin: 0, fontSize: "32px", fontWeight: 700, letterSpacing: "0.24em" }}>{otp}</Text>
    </Section>
    <Text style={{ color: "#78716c", fontSize: "14px", lineHeight: "22px" }}>{ignore}</Text>
  </EmailLayout>
}
