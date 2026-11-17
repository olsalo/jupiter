import type { ReactNode } from "react"
import { Body, Container, Head, Heading, Html, Preview } from "react-email"
import type { EmailLocale } from "~/lib/email-templates/types"

export function EmailLayout({ children, locale, preview, title }: { children: ReactNode; locale: EmailLocale; preview: string; title: string }) {
  return <Html lang={locale}>
    <Head />
    <Preview>{preview}</Preview>
    <Body style={{ margin: 0, backgroundColor: "#ffffff", color: "#1c1917", fontFamily: "Arial, Helvetica, sans-serif", padding: "48px 24px" }}>
      <Container style={{ maxWidth: "480px" }}>
        <Heading style={{ margin: "0 0 24px", fontSize: "24px", lineHeight: "34px", fontWeight: 600 }}>{title}</Heading>
        {children}
      </Container>
    </Body>
  </Html>
}
