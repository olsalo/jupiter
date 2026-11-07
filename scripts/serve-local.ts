import { spawn } from "node:child_process"
import { access } from "node:fs/promises"
import { createServer } from "node:net"
import { createLocalPreviewServer } from "./lib/local-preview.ts"

const port = Number(process.env.PORT || 3000)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535")
await access(new URL("../build/server/index.js", import.meta.url)).catch(() => {
  throw new Error("Run npm run build before npm run start:local")
})

const origin = `http://127.0.0.1:${port}`
const reservation = createServer()
await new Promise<void>((resolve, reject) => {
  reservation.once("error", reject)
  reservation.listen(0, "127.0.0.1", resolve)
})
const address = reservation.address()
if (!address || typeof address === "string") throw new Error("Could not reserve the local server port")
const upstreamPort = address.port
await new Promise<void>((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()))

const proxy = createLocalPreviewServer(upstreamPort, origin)
await new Promise<void>((resolve, reject) => {
  proxy.once("error", reject)
  proxy.listen(port, "127.0.0.1", resolve)
})

const child = spawn(process.execPath, ["./node_modules/@react-router/serve/bin.cjs", "./build/server/index.js"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    LOCAL_PREVIEW_EMAIL: "console",
    HOST: "127.0.0.1",
    PORT: String(upstreamPort),
    BETTER_AUTH_URL: origin,
    BETTER_AUTH_ALLOWED_HOSTS: new URL(origin).host,
    TRUSTED_CLIENT_IP_HEADER: "x-real-ip",
  },
})

console.info(`Local production preview: ${origin}`)
console.info("Open this URL after the production server starts. Sign-in codes are printed in this terminal")

function stop() {
  proxy.close()
  proxy.closeAllConnections()
  child.kill("SIGTERM")
}

process.once("SIGINT", stop)
process.once("SIGTERM", stop)
child.once("error", (error) => {
  console.error(error)
  stop()
  process.exitCode = 1
})
child.once("exit", (code) => {
  proxy.close()
  proxy.closeAllConnections()
  process.exitCode = code ?? 0
})
