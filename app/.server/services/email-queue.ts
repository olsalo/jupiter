import type { Prisma } from "../../../generated/prisma/client"
import type { EmailLocale, EmailTemplate } from "~/lib/email-templates/types"

// Both appointment emails and invitations store the same rendered snapshot
export function queuedEmailContent(template: EmailTemplate, locale: EmailLocale, metadata: Prisma.InputJsonObject = {}) {
  return {
    subject: template.subject,
    body: template.text,
    metadata: { ...metadata, locale, emailHtml: template.html },
  }
}
