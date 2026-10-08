import { fileURLToPath } from "node:url"

import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

/**
 * Dev server port 5173 — the admin's fixed slot next to the API and the
 * customer portal. `strictPort: false` lets Vite fall forward to 5174+ when
 * 5173 is busy, which is friendlier than a hard boot failure when a second
 * checkout is running.
 *
 * The port lives here only: `package.json` runs a bare `vite` so a CLI flag
 * cannot silently override it.
 *
 * No proxy: the browser calls the API at its absolute `VITE_API_URL`, so the
 * admin and the API share CORS rather than an origin rewrite.
 */
export default defineConfig(({ command }) => ({
  plugins: [
    ...(command === "build"
      ? [cloudflare({ persistState: { path: "../../.wrangler/admin" } })]
      : []),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    /**
     * One React per bundle, whatever node_modules says. The workspace links
     * into bun's `.bun` store while the root tree holds its own physical copy
     * of react, so Radix — resolved from the root — would otherwise ship a
     * second React and every hook in it sees a null dispatcher.
     */
    dedupe: ["react", "react-dom"],
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
    outDir: "dist/client",
    sourcemap: true,
  },
}))
