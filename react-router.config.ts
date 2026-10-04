import type { Config } from "@react-router/dev/config"
export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  future: {
    // Discover route dependencies before the first client navigation.
    unstable_optimizeDeps: true,
  },
} satisfies Config
