import { closeDatabase } from "@dropx/db"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { prettyJSON } from "hono/pretty-json"
import { secureHeaders } from "hono/secure-headers"

import { getConfig } from "./config"
import { notFound, onError } from "./shared/errors/handler"
import { requestContext } from "./shared/http/context"
import { attachAuth } from "./shared/auth/middleware"
import { assertPolicyCatalog, getPolicyCatalog } from "./shared/auth/policy"
import { assertOpenApiCoverage } from "./openapi/coverage"
import { openApiRouter } from "./openapi"
import { MODULES, moduleManifest, registerModules } from "./modules"
import { response } from "./core/http"
import type { AppEnv } from "./types/env"

/**
 * Application wiring.
 *
 * Middleware order is deliberate:
 *   requestContext  — correlation id, logger, database handle
 *   error handlers  — installed before any route so early failures are formatted
 *   cors/headers    — before auth so preflights short-circuit
 *   attachAuth      — populates the actor; a missing token yields `public`
 *   modules         — each route declares its own policy
 */
export function createApp(): Hono<AppEnv> {
  const config = getConfig()

  const app = new Hono<AppEnv>()

  app.onError(onError)
  app.notFound(notFound)

  app.use("*", requestContext)
  // HSTS is only meaningful over TLS, so it is enabled for production only.
  app.use("*", secureHeaders(config.isProduction ? { strictTransportSecurity: true } : {}))
  app.use(
    "*",
    cors({
      origin: (origin) => (origin && config.corsOrigins.includes(origin) ? origin : null),
      allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
      allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      exposeHeaders: ["X-Request-Id"],
      credentials: false,
      maxAge: 600,
    }),
  )
  app.use("*", prettyJSON({ space: config.isProduction ? 0 : 2 }))
  app.use("*", attachAuth)

  // The OpenAPI spec + Swagger UI are self-describing (shapes only, no secrets),
  // so they are public and unversioned: /openapi.json and /docs. Mounted after
  // attachAuth but they do not require an actor; gate them at the edge if needed.
  app.route("/", openApiRouter)

  app.get("/", (c) =>
    c.json(response.success({
      service: "dropx-api",
      version: "0.0.0",
      modules: moduleManifest(),
      docs: {
        api: "/api/v1",
        openapi: "/openapi.json",
        swagger: "/docs",
        product: "docs/overview.md and docs/rbac.md",
      },
    })),
  )

  registerModules(app)

  // Fail fast at boot if a feature forgot to declare its operations, or if the
  // published spec no longer matches what the policy catalog enforces.
  assertPolicyCatalog()
  assertOpenApiCoverage()

  if (!config.isProduction) {
    console.info(`[api] operations registered: ${getPolicyCatalog().size}`)
    console.info("[api] openapi: /openapi.json  docs: /docs")
  }

  return app
}

export { MODULES, closeDatabase }
