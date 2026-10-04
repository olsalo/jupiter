import { sendEmail } from "~/lib/email.server"
import { createFormResponseEmailTemplate } from "~/lib/email-templates/form-response"
import type { prisma as client } from "~/lib/prisma.server"

export async function notifyNewFormResponse(prisma: typeof client, formId: string) {
  if (!process.env.EMAIL_PROVIDER?.trim()) return

  const form = await prisma.form.findUniqueOrThrow({
    where: { id: formId },
    select: { title: true, organizationId: true },
  })
  const recipients = await prisma.user.findMany({
    where: {
      newResponseEmail: true,
      emailVerified: true,
      members: { some: { organizationId: form.organizationId } },
    },
    select: { email: true, locale: true },
  })
  if (!recipients.length) return

  const baseUrl = process.env.BETTER_AUTH_URL || process.env.VITE_URL
  if (!baseUrl) throw new Error("BETTER_AUTH_URL is required for response notification links")
  const responsesUrl = new URL(`/forms/${encodeURIComponent(formId)}/responses`, baseUrl).href

  const deliveries = await Promise.allSettled(recipients.map((recipient) => sendEmail({
    ...createFormResponseEmailTemplate({
      formTitle: form.title,
      responsesUrl,
      locale: recipient.locale === "fi" ? "fi" : "en",
    }),
    to: recipient.email,
  })))
  for (const delivery of deliveries) {
    if (delivery.status === "rejected") {
      console.error("Failed to send new response email", delivery.reason)
    }
  }
}
