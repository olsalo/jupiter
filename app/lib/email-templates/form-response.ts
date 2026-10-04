import type { EmailLocale } from "./otp"

export function createFormResponseEmailTemplate({
  formTitle,
  responsesUrl,
  locale,
}: {
  formTitle: string
  responsesUrl: string
  locale: EmailLocale
}) {
  const title = locale === "fi" ? "Uusi lomakevastaus" : "New form response"
  const description = locale === "fi"
    ? `Lomakkeeseen ”${formTitle}” on lähetetty uusi vastaus.`
    : `A new response has been submitted to “${formTitle}”.`
  const action = locale === "fi" ? "Katso vastaukset" : "View responses"
  const footer = locale === "fi"
    ? "Voit poistaa nämä sähköpostit käytöstä asetusten Ilmoitukset-kohdassa."
    : "You can turn off these emails in Settings → Notifications."

  return {
    subject: title,
    text: `${description}\n\n${action}: ${responsesUrl}\n\n${footer}`,
    html: `<html lang="${locale}"><body style="font-family:Arial,sans-serif;line-height:1.6"><h1>${title}</h1><p>${escapeHtml(description)}</p><p><a href="${escapeHtml(responsesUrl)}">${action}</a></p><p style="color:#666;font-size:13px">${footer}</p></body></html>`,
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!)
}
