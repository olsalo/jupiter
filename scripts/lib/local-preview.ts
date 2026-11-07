import { createServer, request, type IncomingHttpHeaders } from "node:http"

export function localPreviewHeaders(headers: IncomingHttpHeaders, origin: string, address: string) {
  const forwarded = { ...headers }
  delete forwarded.forwarded
  return {
    ...forwarded,
    host: new URL(origin).host,
    "x-forwarded-host": new URL(origin).host,
    "x-forwarded-proto": "http",
    "x-forwarded-for": address,
    "x-real-ip": address,
  }
}

export function createLocalPreviewServer(upstreamPort: number, origin: string) {
  return createServer((incoming, outgoing) => {
    if (incoming.headers.host !== new URL(origin).host) {
      outgoing.writeHead(403).end("Open the local preview URL shown in the terminal")
      return
    }

    const upstream = request({
      hostname: "127.0.0.1",
      port: upstreamPort,
      method: incoming.method,
      path: incoming.url,
      headers: localPreviewHeaders(incoming.headers, origin, incoming.socket.remoteAddress ?? "127.0.0.1"),
    }, (response) => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers)
      response.pipe(outgoing)
      response.on("error", () => outgoing.destroy())
    })

    upstream.on("error", () => {
      if (!outgoing.headersSent) outgoing.writeHead(502)
      outgoing.end("The local production server is starting. Refresh in a moment")
    })
    incoming.on("aborted", () => upstream.destroy())
    outgoing.on("close", () => upstream.destroy())
    incoming.pipe(upstream)
  })
}
