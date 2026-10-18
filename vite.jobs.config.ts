import { defineConfig } from "vite"

export default defineConfig({
  resolve: { alias: { "~": new URL("./app", import.meta.url).pathname } },
  build: {
    ssr: "app/.server/jobs/runner.ts",
    outDir: "build/jobs",
    emptyOutDir: false,
    rollupOptions: { output: { entryFileNames: "runner.js" } },
  },
})
