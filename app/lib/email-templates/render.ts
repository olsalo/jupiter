import type { ReactNode } from "react"
import { render, toPlainText } from "react-email"

import type { EmailTemplate } from "./types"

export async function renderEmail(subject: string, element: ReactNode): Promise<EmailTemplate> {
  const html = await render(element)
  return { subject, html, text: toPlainText(html) }
}
