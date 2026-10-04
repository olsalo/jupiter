import { PassThrough } from "node:stream"
import { createReadableStreamFromReadable } from "@react-router/node"
import { isbot } from "isbot"
import type { RenderToPipeableStreamOptions } from "react-dom/server"
import { renderToPipeableStream } from "react-dom/server"
import type { EntryContext, RouterContextProvider } from "react-router"
import { ServerRouter } from "react-router"
import { I18nextProvider } from "react-i18next"

import { getInstance } from "~/middleware/i18next"

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  entryContext: EntryContext,
  routerContext: RouterContextProvider,
) {
  const i18n = getInstance(routerContext)

  return new Promise<Response>((resolve, reject) => {
    const userAgent = request.headers.get("user-agent")
    const readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || entryContext.isSpaMode
        ? "onAllReady"
        : "onShellReady"

    const { pipe, abort } = renderToPipeableStream(
      <I18nextProvider i18n={i18n}>
        <ServerRouter context={entryContext} url={request.url} />
      </I18nextProvider>,
      {
        [readyOption]() {
          const body = new PassThrough()

          responseHeaders.set("Content-Type", "text/html")
          resolve(
            new Response(createReadableStreamFromReadable(body), {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          )
          pipe(body)
        },
        onShellError(error: unknown) {
          reject(error)
        },
        onError(error: unknown) {
          responseStatusCode = 500
          console.error(error)
        },
      },
    )

    setTimeout(abort, 6_000)
  })
}
