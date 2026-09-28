import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

/**
 * Dev server port 3002 — the console's fixed slot next to the API and the
 * customer portal. `strictPort: false` lets Vite fall forward to 3003+ when
 * 3002 is busy, which is friendlier than a hard boot failure when a second
 * checkout is running.
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
    port: 3002,
    strictPort: false,
  },
  preview: {
    port: 3002,
    strictPort: false,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
})
