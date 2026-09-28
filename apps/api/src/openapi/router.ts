import { Hono } from "hono"
import { swaggerUI } from "@hono/swagger-ui"

import type { AppEnv } from "../types/env"
import { openApiDocument } from "./document"

/**
 * Serves the OpenAPI document and its Swagger UI.
 *
 * Deliberately **public and unversioned** (`/openapi.json`, `/docs`): the spec is
 * the map of the whole surface including its version, so gating it behind
 * `/api/v1` would be circular, and an admin token would be needed to read the
 * doc that says how to get one. The spec describes no secrets — only shapes.
 *
 * This is a self-describing contract, not a secret. If a deployment needs it
 * private, put these two paths behind the edge proxy; nothing else here changes.
 */

const router = new Hono<AppEnv>()

router.get("/openapi.json", (c) => c.json(openApiDocument))

router.get(
  "/docs",
  swaggerUI({
    url: "/openapi.json",
    // Expose operation ids so the docs double as the catalog's human view.
    displayOperationId: true,
    tryItOutEnabled: true,
    // Self-hosted assets; no CDN dependency at runtime.
    filter: true,
  }),
)

export default router

export { openApiDocument }
