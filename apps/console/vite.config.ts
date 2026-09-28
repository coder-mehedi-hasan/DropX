import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

/**
 * Dev server port 5173 — the console's fixed slot next to the API and the
 * customer portal. `strictPort: false` lets Vite fall forward to 5174+ when
 * 5173 is busy, which is friendlier than a hard boot failure when a second
 * checkout is running.
 *
 * The port lives here only: `package.json` runs a bare `vite` so a CLI flag
 * cannot silently override it.
 *
 * No proxy: the browser calls the API at its absolute `VITE_API_URL`, so the
 * console and the API share CORS rather than an origin rewrite.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
})
