import { sendEmail } from "~/lib/email/email.server"
import { marketingAccessRequestSchema } from "~/lib/schemas/marketing"

export async function sendMarketingAccessRequest(input: { email: string }) {
  const { email } = marketingAccessRequestSchema.parse(input)
  const recipient = marketingAccessRequestSchema.safeParse({ email: process.env.MARKETING_ACCESS_REQUEST_TO })
  if (!recipient.success) throw new Error("MARKETING_ACCESS_REQUEST_TO must be a valid email address")

  const escapedEmail = email.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!)

  await sendEmail({
    to: recipient.data.email,
    replyTo: email,
    subject: "New Jupiter access request",
    text: `Someone requested access to Jupiter\n\nEmail: ${email}`,
    html: `<p>Someone requested access to Jupiter</p><p>Email: ${escapedEmail}</p>`,
  })
}
