import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    alias: {
      "@coss/ui/components": fileURLToPath(
        new URL("./app/components/ui", import.meta.url),
      ),
      "@coss/ui/lib": fileURLToPath(new URL("./app/lib", import.meta.url)),
      "@": fileURLToPath(new URL("./app", import.meta.url)),
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
})
