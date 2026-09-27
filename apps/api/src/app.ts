import { closeDatabase } from "@dropx/db";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";

import { getConfig } from "./config";
import { notFound, onError } from "./shared/errors/handler";
import { requestContext } from "./shared/http/context";
import { attachAuth } from "./shared/auth/middleware";
import { assertPolicyCatalog, getPolicyCatalog } from "./shared/auth/policy";
import { MODULES, moduleManifest, registerModules } from "./modules";
import type { AppEnv } from "./types/env";

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
  const config = getConfig();

  const app = new Hono<AppEnv>();

  app.onError(onError);
  app.notFound(notFound);

  app.use("*", requestContext);
  // HSTS is only meaningful over TLS, so it is enabled for production only.
  app.use("*", secureHeaders(config.isProduction ? { strictTransportSecurity: true } : {}));
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
  );
  app.use("*", prettyJSON({ space: config.isProduction ? 0 : 2 }));
  app.use("*", attachAuth);

  app.get("/", (c) =>
    c.json({
      service: "dropx-api",
      version: "0.0.0",
      modules: moduleManifest(),
      docs: "See docs/overview.md and docs/rbac.md",
    }),
  );

  registerModules(app);

  // Fail fast at boot if a feature forgot to declare its operations.
  assertPolicyCatalog();

  if (!config.isProduction) {
    console.info(`[api] operations registered: ${getPolicyCatalog().size}`);
  }

  return app;
}

export { MODULES, closeDatabase };
