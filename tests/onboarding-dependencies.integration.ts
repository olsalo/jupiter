import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createServer, optimizeDeps } from "vite"

const cacheDir = await mkdtemp(join(tmpdir(), "astra-onboarding-deps-"))
const vite = await createServer({
  cacheDir,
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
})

try {
  // Scan from a cold cache without requesting any route in the browser.
  const metadata = await optimizeDeps(vite.config, true)

  for (const dependency of [
    "react",
    "react-dom/client",
    "@base-ui/react/progress",
    "@rvf/react",
  ]) {
    assert.ok(
      metadata.optimized[dependency],
      `${dependency} must be optimized before the first onboarding navigation`,
    )
  }

  console.info("PASS Onboarding dependencies are optimized before navigation")
} finally {
  await vite.close()
  await rm(cacheDir, { recursive: true, force: true })
}
