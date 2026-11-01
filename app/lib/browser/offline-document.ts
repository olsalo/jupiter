import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import Icon from "../../components/icons.tsx"
import enCommon from "../../locales/en/common.json" with { type: "json" }
import fiCommon from "../../locales/fi/common.json" with { type: "json" }

export function createOfflineDocument(locale: "en" | "fi") {
  const icon = renderToStaticMarkup(createElement(Icon, { name: "wifiOff", size: 24, "aria-hidden": true }))
  const narrowIcon = renderToStaticMarkup(createElement(Icon, { name: "infoCircle", size: 24, "aria-hidden": true }))
  const translations = locale === "fi" ? fiCommon : enCommon
  const messages = translations.offline
  const narrowMessages = translations.narrow

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
      .offline-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        margin: 0 auto 16px;
        border-radius: 50%;
        background: rgb(0 0 0 / 4%);
        color: #737373;
      }
      .narrow-message { display: none }
      @media (max-width: 374px), (orientation: landscape) and (max-height: 500px) and (pointer: coarse) {
        .offline-message { display: none }
        .narrow-message { display: block }
      }
      h1 { margin: 0 0 12px; font-size: 24px; font-weight: 600; letter-spacing: -.025em }
      p { margin: 0; color: #737373; font-size: 15px; line-height: 1.6 }
      @media (prefers-color-scheme: dark) {
        body { background: #171717; color: #fafafa }
        p { color: #a3a3a3 }
        .offline-icon { background: rgb(255 255 255 / 4%); color: #a3a3a3 }
      }
    </style>
  </head>
  <body>
    <main>
      <div class="offline-message">
        <div class="offline-icon">${icon}</div>
        <h1>${messages.title}</h1>
        <p>${messages.description}</p>
      </div>
      <div class="narrow-message">
        <div class="offline-icon">${narrowIcon}</div>
        <h1>${narrowMessages.title}</h1>
        <p>${narrowMessages.description}</p>
      </div>
    </main>
  </body>
</html>
`
}
