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

/**
 * `bun --watch` re-evaluates this module on every save, so module state cannot
 * own the socket. The live server and the one-time signal wiring hang off
 * `globalThis`, and a reload stops the previous server before binding the new
 * one — without that the second `Bun.serve` dies with EADDRINUSE on save.
 *
 * There is deliberately no default export carrying `fetch`: Bun's reload path
 * auto-serves a default export of its own, which would race the explicit server
 * below for the same port. Callers that want the app itself import `createApp`.
 */
type Runtime = {
  server?: ReturnType<typeof Bun.serve>
  listenersBound?: boolean
}

const globalScope = globalThis as typeof globalThis & { __dropxApi?: Runtime }
const runtime: Runtime = (globalScope.__dropxApi ??= {})

runtime.server?.stop(true)

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

runtime.server = server

console.info(`[api] listening on http://localhost:${server.port} (${config.env})`)

if (!runtime.listenersBound) {
  runtime.listenersBound = true
  process.on("SIGINT", () => void shutdown("SIGINT"))
  process.on("SIGTERM", () => void shutdown("SIGTERM"))
}

async function shutdown(signal: string): Promise<void> {
  console.info(`[api] ${signal} received, shutting down`)
  await runtime.server?.stop(true)
  await closeDatabase()
  process.exit(0)
}

export { app, server }
