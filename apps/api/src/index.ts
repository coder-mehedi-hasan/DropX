import { closeDatabase, getDatabase } from "@dropx/db"

import { createApp } from "./app"
import { getConfig } from "./config"

/**
 * Process entry point.
 *
 * Bun serves the exported `fetch`, so there is no node adapter in the path.
 * The preflight `ping` fails fast with a clear message rather than surfacing a
 * connection error on the first request.
 */
const config = getConfig()
const app = createApp()

try {
  await getDatabase().ping()
} catch (error) {
  console.error("[api] cannot reach the database — check DATABASE_URL", error)
  process.exit(1)
}

const server = Bun.serve({
  port: config.port,
  fetch: app.fetch,
  // Parcel events, proof uploads and OTP requests all have small bodies; the
  // ceiling stops a single request from pinning memory.
  maxRequestBodySize: 2 * 1024 * 1024,
  idleTimeout: 30,
})

console.info(`[api] listening on http://localhost:${server.port} (${config.env})`)

async function shutdown(signal: string): Promise<void> {
  console.info(`[api] ${signal} received, shutting down`)
  await server.stop(true)
  await closeDatabase()
  process.exit(0)
}

process.on("SIGINT", () => void shutdown("SIGINT"))
process.on("SIGTERM", () => void shutdown("SIGTERM"))

export { app, server }
export default { port: server.port, fetch: app.fetch }
