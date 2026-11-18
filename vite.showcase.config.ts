import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [tailwindcss()],
  cacheDir: "node_modules/.vite-showcase",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./app", import.meta.url)),
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
  build: { rollupOptions: { input: "showcase.html" } },
  server: { host: "127.0.0.1", port: 1421, strictPort: true },
})
