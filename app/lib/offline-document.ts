import enCommon from "../locales/en/common.json" with { type: "json" }
import fiCommon from "../locales/fi/common.json" with { type: "json" }

export function createOfflineDocument(locale: "en" | "fi") {
  const messages = locale === "fi" ? fiCommon.offline : enCommon.offline

  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="5" />
    <meta name="color-scheme" content="light dark" />
    <title>${messages.title}</title>
    <style>
      * { box-sizing: border-box }
      body {
        margin: 0;
        min-height: 100dvh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: #fff;
        color: #171717;
        font-family: system-ui, sans-serif;
      }
      main { width: 100%; max-width: 360px; text-align: center }
      h1 { margin: 0 0 12px; font-size: 24px; font-weight: 600; letter-spacing: -.025em }
      p { margin: 0; color: #737373; font-size: 15px; line-height: 1.6 }
      @media (prefers-color-scheme: dark) {
        body { background: #171717; color: #fafafa }
        p { color: #a3a3a3 }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${messages.title}</h1>
      <p>${messages.description}</p>
    </main>
  </body>
</html>
`
}
