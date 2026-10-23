import { createElement } from "react"
import { InvitationEmail } from "~/components/emails/invitation"
import { renderEmail } from "./render"
import { getEmailTranslations } from "./translations"
import type { EmailLocale, EmailTemplate } from "./types"

export function createInvitationEmailTemplate({
  organizationName,
  inviteUrl,
  locale,
}: {
  organizationName: string
  inviteUrl: string
  locale: EmailLocale
}): Promise<EmailTemplate> {
  const t = getEmailTranslations(locale)
  const title = t("invitation.title", { organizationName })
  const description = t("invitation.description")
  const action = t("invitation.action")

  return renderEmail(title, createElement(InvitationEmail, { locale, title, description, action, inviteUrl }))
}
