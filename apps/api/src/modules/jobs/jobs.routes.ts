import { Hono } from "hono"

import { ERROR_CODES, DomainError, validateJson, validateParam, validateQuery } from "../../core"
import { isRider } from "../../shared/auth/auth-context"
import { PERMISSIONS } from "../../shared/auth/permissions"
import { defineOperation } from "../../shared/auth/policy"
import type { AppEnv } from "../../types/env"
import { jobIdParamSchema, listJobsQuerySchema, updateJobStatusSchema } from "./jobs.dto"
import { getJob, listJobs, reportOutcome } from "./jobs.service"

/**
 * The rider app's job surface.
 *
 * Gated on `rider.jobs.*` rather than the console's `parcels.*` keys, so a rider
 * token can never reach a console operation, and the payload is scoped to the
 * rider's own assignments in the repository. The rider is never asked for an id.
 */
const router = new Hono<AppEnv>()

const idParam = validateParam(jobIdParamSchema)

router.get(
  "/",
  defineOperation(
    { id: "job.list", audience: ["riders"], permissions: [PERMISSIONS.RIDER_JOBS_VIEW] },
    { method: "GET", path: "/jobs" },
  ),
  validateQuery(listJobsQuerySchema),
  async (c) => {
    const auth = c.get("auth")
    if (!isRider(auth)) {
      throw new DomainError(ERROR_CODES.FORBIDDEN, "This app is for riders")
    }
    return c.json(await listJobs(c.get("db"), auth.actor.riderId, c.req.valid("query")))
  },
)

router.get(
  "/:id",
  defineOperation(
    { id: "job.read", audience: ["riders"], permissions: [PERMISSIONS.RIDER_JOBS_VIEW] },
    { method: "GET", path: "/jobs/:id" },
  ),
  idParam,
  async (c) => {
    const auth = c.get("auth")
    if (!isRider(auth)) {
      throw new DomainError(ERROR_CODES.FORBIDDEN, "This app is for riders")
    }
    return c.json(await getJob(c.get("db"), auth.actor.riderId, c.req.param("id")))
  },
)

router.patch(
  "/:id/status",
  defineOperation(
    { id: "job.reportOutcome", audience: ["riders"], permissions: [PERMISSIONS.RIDER_JOBS_UPDATE] },
    { method: "PATCH", path: "/jobs/:id/status" },
  ),
  idParam,
  validateJson(updateJobStatusSchema),
  async (c) => {
    const auth = c.get("auth")
    if (!isRider(auth)) {
      throw new DomainError(ERROR_CODES.FORBIDDEN, "This app is for riders")
    }

    const job = await reportOutcome(c.get("db"), {
      riderId: auth.actor.riderId,
      riderUserId: auth.actor.userId,
      parcelId: c.req.param("id"),
      input: c.req.valid("json"),
    })

    return c.json(job)
  },
)

export default router
