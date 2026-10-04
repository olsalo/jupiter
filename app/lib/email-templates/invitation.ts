import type { EmailLocale } from "./otp"

export function createInvitationEmailTemplate({
  organizationName,
  inviteUrl,
  locale,
}: {
  organizationName: string
  inviteUrl: string
  locale: EmailLocale
}) {
  const title = locale === "fi"
    ? `Sinut on kutsuttu tiimiin ${organizationName}`
    : `You're invited to join ${organizationName}`
  const description = locale === "fi"
    ? "Avaa alla oleva linkki ja kirjaudu sisään tällä sähköpostiosoitteella liittyäksesi tiimiin. Kutsu on voimassa 48 tuntia."
    : "Open the link below and sign in with this email address to join the team. This invitation expires in 48 hours."
  const action = locale === "fi" ? "Liity tiimiin" : "Join the team"

  return {
    subject: title,
    text: `${title}\n\n${description}\n\n${inviteUrl}`,
    html: `<html lang="${locale}"><body style="font-family:Arial,sans-serif;line-height:1.6"><h1>${escapeHtml(title)}</h1><p>${description}</p><p><a href="${escapeHtml(inviteUrl)}">${action}</a></p></body></html>`,
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!)
}
