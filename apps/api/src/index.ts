import { Hono } from "hono"
import { cors } from "hono/cors"
import { prettyJSON } from "hono/pretty-json"
import { secureHeaders } from "hono/secure-headers"

import { getConfig } from "./config"
import { notFound, onError } from "./shared/errors/handler"
import { requestContext } from "./shared/http/context"
import { attachAuth } from "./shared/auth/middleware"
import { assertPolicyCatalog, getPolicyCatalog } from "./shared/auth/policy"
import { assertOpenApiCoverage } from "./openapi"
import { openApiRouter } from "./openapi"
import { registerModules } from "./modules"
import { response } from "./core/http"
import { processEmailJob } from "./shared/email/processor"
import { EMAIL_QUEUE } from "./shared/email/queue"
import { registerJobProcessor } from "./shared/queue"
import type { AppEnv } from "./types/env"
import { closePool, pool as databasePool } from "./db/pool"

const config = getConfig()

const app = new Hono<AppEnv>()

app.onError(onError)
app.notFound(notFound)
// All context values are bound here, in a single requestContext middleware.
app.use("*", requestContext)
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
  c.json(
    response.success({
      service: "dropx-api",
      version: "0.0.0",
      docs: { openapi: "/openapi.json", swagger: "/docs" },
    }),
  ),
)

registerModules(app)

assertPolicyCatalog()
assertOpenApiCoverage()

if (!config.isProduction) {
  console.info(`[api] operations registered: ${getPolicyCatalog().size}`)
  console.info("[api] openapi: /openapi.json  docs: /docs")
}

// Starts a job processor for every queue. One line per queue.
registerJobProcessor(EMAIL_QUEUE, processEmailJob)

// Graceful shutdown: close the MySQL pool (and let Redis / SMTP clean up).
process.on("SIGTERM", async () => {
  try {
    await closePool(databasePool)
  } catch {
    // ignore cleanup errors during shutdown
  }
  process.exit(0)
})

export default { port: config.port, fetch: app.fetch }
