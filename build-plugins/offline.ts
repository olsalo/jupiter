import { readFileSync } from "node:fs"
import { transformWithOxc, type Plugin } from "vite"
import { createOfflineDocument } from "../app/lib/offline-document.ts"

// Serve the same standalone TypeScript worker in development and production.
export function offlinePlugin(): Plugin {
  const workerPath = new URL("../app/service-worker.ts", import.meta.url)
  const compileWorker = async () => (await transformWithOxc(
    readFileSync(workerPath, "utf8"),
    workerPath.pathname,
    { lang: "ts" },
  )).code

  return {
    name: "offline-fallback",
    enforce: "pre",
    applyToEnvironment: (environment) => environment.name === "client",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = request.url?.split("?")[0]
        if (!["/service-worker.js", "/offline.html", "/offline-fi.html"].includes(pathname ?? "")) return next()

        try {
          response.setHeader("Content-Type", pathname === "/service-worker.js" ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8")
          response.setHeader("Cache-Control", "no-cache")
          response.end(pathname === "/service-worker.js"
            ? await compileWorker()
            : createOfflineDocument(pathname === "/offline-fi.html" ? "fi" : "en"))
        } catch (error) {
          next(error)
        }
      })
    },
    async generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "service-worker.js",
        source: await compileWorker(),
      })
      for (const locale of ["en", "fi"] as const) {
        this.emitFile({
          type: "asset",
          fileName: locale === "fi" ? "offline-fi.html" : "offline.html",
          source: createOfflineDocument(locale),
        })
      }
    },
  }
}
