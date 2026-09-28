import { jsonSchemaOf } from "../schema"
import { z } from "zod"

/**
 * `health` — liveness and readiness.
 *
 * Both are public. `GET /health` never touches the database, so a crash-loop
 * probe cannot be caused by a slow database; `GET /health/ready` pings it and is
 * what a process manager's readiness check should use.
 *
 * Health is the one module served **both** under `/api/v1` and unversioned, so
 * a future `/v2` rollout cannot break a load balancer's probe. The spec
 * documents the versioned path; the unversioned alias is noted in each summary.
 */

const json = (schema: ReturnType<typeof jsonSchemaOf>) => ({
  content: { "application/json": { schema } },
})

const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  uptimeSeconds: z.number(),
  timestamp: z.iso.datetime(),
})

const readyResponseSchema = z.object({
  status: z.enum(["ready", "degraded"]),
  database: z.enum(["up", "down"]),
})

export const healthPaths = {
  "/health": {
    get: {
      operationId: "health.read",
      summary: "Liveness probe",
      description:
        "Process is up. Does not touch the database. Also served unversioned at `/health`.",
      tags: ["health"],
      security: [],
      responses: {
        200: { description: "Alive.", ...json(jsonSchemaOf(healthResponseSchema, "output")) },
      },
    },
  },
  "/health/ready": {
    get: {
      operationId: "health.ready",
      summary: "Readiness probe",
      description:
        "Process is up *and* the database answers a ping. Returns 503 when the database is unreachable. Also served unversioned at `/health/ready`.",
      tags: ["health"],
      security: [],
      responses: {
        200: { description: "Ready.", ...json(jsonSchemaOf(readyResponseSchema, "output")) },
        503: {
          description: "Degraded — the database did not answer.",
          ...json(jsonSchemaOf(readyResponseSchema, "output")),
        },
      },
    },
  },
} as const

export const healthTags = [{ name: "health", description: "Liveness and readiness probes." }]
