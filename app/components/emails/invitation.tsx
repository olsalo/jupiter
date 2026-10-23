import { Button, Text } from "react-email"
import { EmailLayout } from "./layout"
import type { EmailLocale } from "~/lib/email-templates/types"

export function InvitationEmail({ locale, title, description, action, inviteUrl }: { locale: EmailLocale; title: string; description: string; action: string; inviteUrl: string }) {
  return <EmailLayout locale={locale} preview={title} title={title}>
    <Text style={{ color: "#57534e", fontSize: "16px", lineHeight: "26px" }}>{description}</Text>
    <Button href={inviteUrl} style={{ backgroundColor: "#1c1917", color: "#ffffff", borderRadius: "8px", padding: "14px 24px", fontSize: "16px" }}>{action}</Button>
  </EmailLayout>
}
