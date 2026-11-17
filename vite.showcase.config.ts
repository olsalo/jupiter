import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [tailwindcss()],
  cacheDir: "node_modules/.vite-showcase",
  resolve: {
    alias: {
      "@coss/ui/components": fileURLToPath(new URL("./app/components/ui", import.meta.url)),
      "@coss/ui/lib": fileURLToPath(new URL("./app/lib", import.meta.url)),
      "@": fileURLToPath(new URL("./app", import.meta.url)),
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
  build: { rollupOptions: { input: "showcase.html" } },
  server: { host: "127.0.0.1", port: 1421, strictPort: true },
})
