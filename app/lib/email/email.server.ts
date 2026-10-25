import type { EmailLocale } from "~/lib/email-templates/types"
import { Resend } from "resend"

import {
  createOtpEmailTemplate,
  type OtpEmailType,
} from "~/lib/email-templates/otp"

export interface EmailMessage {
  html: string
  senderName?: string
  replyTo?: string
  subject: string
  text: string
  to: string | string[]
}

interface OtpEmailOptions {
  email: string
  locale: EmailLocale
  otp: string
  type: OtpEmailType
}

export const emailOtpExpiresInMinutes = 5

export async function sendEmail(message: EmailMessage) {
  const recipients = getDeliveryRecipients(message.to)
  const provider = getEmailProvider()

  if (!provider) {
    if (process.env.NODE_ENV === "production") throw new Error("EMAIL_PROVIDER is required to send email in production")
    return
  }

  const apiKey =
    provider === "plunk" ? process.env.PLUNK_API_KEY : process.env.RESEND_API_KEY

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`${getApiKeyName(provider)} is required to send email in production`)
    }

    console.info(
      `[email:development] ${message.subject} -> ${formatRecipients(recipients)}`,
    )
    console.info(message.text)
    return
  }

  const from = process.env.EMAIL_FROM

  if (!from) {
    throw new Error(`EMAIL_FROM is required when ${getApiKeyName(provider)} is configured`)
  }

  if (provider === "plunk") {
    await sendWithPlunk({ apiKey, from, message, recipients })
    return
  }

  await sendWithResend({ apiKey, from, message, recipients })
}

export async function sendOtpEmail({ email, locale, otp, type }: OtpEmailOptions) {
  const provider = getEmailProvider()

  if (!provider) {
    if (process.env.NODE_ENV === "production") throw new Error("EMAIL_PROVIDER is required to send email in production")
    if (type === "sign-in") {
      console.info(`[better-auth] ${type} OTP for ${email}: ${otp}`)
    }

    return
  }

  const template = await createOtpEmailTemplate({
    expiresInMinutes: emailOtpExpiresInMinutes,
    locale,
    otp,
    type,
  })

  await sendEmail({
    html: template.html,
    subject: template.subject,
    text: template.text,
    to: email,
  })
}

function formatRecipients(recipients: string | string[]) {
  return Array.isArray(recipients) ? recipients.join(", ") : recipients
}

async function sendWithPlunk({
  apiKey,
  from,
  message,
  recipients,
}: {
  apiKey: string
  from: string
  message: EmailMessage
  recipients: string | string[]
}) {
  const response = await fetch("https://next-api.useplunk.com/v1/send", {
    body: JSON.stringify({
      body: message.html,
      from: message.senderName ? { name: message.senderName, email: getSenderAddress(from) } : from,
      reply: message.replyTo,
      subject: message.subject,
      to: recipients,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  })
  const result = await parsePlunkResponse(response)

  if (!response.ok || result?.success === false) {
    throw new Error(
      `Plunk email delivery failed: ${result?.error?.message ?? response.statusText}`,
    )
  }
}

async function sendWithResend({
  apiKey,
  from,
  message,
  recipients,
}: {
  apiKey: string
  from: string
  message: EmailMessage
  recipients: string | string[]
}) {
  const { error } = await new Resend(apiKey).emails.send({
    from: message.senderName ? `${JSON.stringify(message.senderName)} <${getSenderAddress(from)}>` : from,
    html: message.html,
    replyTo: message.replyTo,
    subject: message.subject,
    text: message.text,
    to: recipients,
  })

  if (error) {
    throw new Error(`Resend email delivery failed: ${error.message}`, { cause: error })
  }
}

async function parsePlunkResponse(response: Response) {
  try {
    return (await response.json()) as {
      error?: { message?: string }
      success?: boolean
    }
  } catch {
    return null
  }
}

function getEmailProvider(): "plunk" | "resend" | null {
  const configuredProvider = process.env.EMAIL_PROVIDER?.trim().toLowerCase()

  if (!configuredProvider) {
    return null
  }

  if (configuredProvider === "plunk" || configuredProvider === "resend") {
    return configuredProvider
  }

  throw new Error(
    `Unsupported EMAIL_PROVIDER: ${process.env.EMAIL_PROVIDER}. Use plunk or resend`,
  )
}

function getApiKeyName(provider: "plunk" | "resend") {
  return provider === "plunk" ? "PLUNK_API_KEY" : "RESEND_API_KEY"
}

function getDeliveryRecipients(recipients: string | string[]) {
  const overrideRecipients = process.env.EMAIL_OVERRIDE_TO?.split(",")
    .map((recipient) => recipient.trim())
    .filter(Boolean)

  if (!overrideRecipients?.length) {
    return recipients
  }

  return overrideRecipients.length === 1 ? overrideRecipients[0] : overrideRecipients
}

function getSenderAddress(from: string) {
  return from.match(/<([^<>]+)>\s*$/)?.[1] ?? from.trim()
}
