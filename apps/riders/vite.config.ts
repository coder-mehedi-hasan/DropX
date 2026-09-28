import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

/**
 * Dev server port 3003 — the rider app's fixed slot. `strictPort` is on because
 * every other DropX frontend falls forward when its own port is busy, so two
 * checkouts would otherwise collide on the fallback range and a rider build
 * could silently come up on the console's port.
 *
 * No proxy: the phone calls the API at its absolute `VITE_API_URL`, so the app
 * and the API share CORS rather than an origin rewrite.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 3003,
    strictPort: true,
  },
  preview: {
    port: 3003,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
})
