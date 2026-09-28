import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

/**
 * Dev server port 5174 — the rider app's fixed slot. `strictPort` is on because
 * every other DropX frontend falls forward when its own port is busy, so two
 * checkouts would otherwise collide on the fallback range and a rider build
 * could silently come up on the admin's port.
 *
 * The port lives here only: `package.json` runs a bare `vite` so a CLI flag
 * cannot silently override it.
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
    port: 5174,
    strictPort: true,
  },
  preview: {
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
})
