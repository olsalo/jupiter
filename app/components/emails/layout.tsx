import type { ReactNode } from "react"
import { Body, Container, Head, Heading, Html, Preview } from "react-email"
import type { EmailLocale } from "~/lib/email-templates/types"

export function EmailLayout({ children, locale, preview, title }: { children: ReactNode; locale: EmailLocale; preview: string; title: string }) {
  return <Html lang={locale}>
    <Head />
    <Preview>{preview}</Preview>
    <Body style={{ margin: 0, backgroundColor: "#f5f5f4", color: "#1c1917", fontFamily: "Arial, Helvetica, sans-serif", padding: "40px 16px" }}>
      <Container style={{ maxWidth: "480px", backgroundColor: "#ffffff", border: "1px solid #e7e5e4", borderRadius: "16px", padding: "32px" }}>
        <Heading style={{ margin: "0 0 16px", fontSize: "24px", lineHeight: "32px" }}>{title}</Heading>
        {children}
      </Container>
    </Body>
  </Html>
}
