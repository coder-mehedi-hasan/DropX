import { defineOperation } from "../../shared/auth/policy"
import { response } from "../../core/http"
import type { AppEnv } from "../../types/env"
import { Hono } from "hono"

/**
 * Liveness + readiness.
 *
 * `GET /health` is public and never touches the database, so a crash-loop probe
 * cannot be caused by a slow database. `GET /health/ready` pings it and is
 * wired to the process manager's readiness check.
 */
const router = new Hono<AppEnv>()

const healthPolicy = { id: "health.read", public: true as const }

router.get("/", defineOperation(healthPolicy, { method: "GET", path: "/health" }), (c) =>
  c.json(
    response.success({
      status: "ok",
      service: "dropx-api",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    }),
  ),
)

router.get(
  "/ready",
  defineOperation({ id: "health.ready", public: true }, { method: "GET", path: "/health/ready" }),
  async (c) => {
    try {
      const conn = await c.get("db")!.getConnection()
      await conn.ping()
      conn.release()
      return c.json(response.success({ status: "ready", database: "up" }))
    } catch (error) {
      console.error("[health/ready]", { error })
      return c.json(response.success({ status: "degraded", database: "down" }, 503), 503)
    }
  },
)

export default router
