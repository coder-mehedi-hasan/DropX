import { Hono } from "hono"

import { ERROR_CODES, DomainError, validateJson, validateParam, validateQuery } from "../../core"
import { response } from "../../core/http"
import { isRider } from "../../shared/auth/auth-context"
import { PERMISSIONS } from "../../shared/auth/permissions"
import { defineOperation } from "../../shared/auth/policy"
import type { AppEnv } from "../../types/env"
import { reportLocationSchema } from "../riders/rider-locations.dto"
import { recordRiderLocation } from "../riders/rider-locations.service"
import { submitProofSchema } from "../deliveries/delivery-proofs.dto"
import { listJobProofs, submitProof } from "../deliveries/delivery-proofs.service"
import {
  jobIdParamSchema,
  listJobsQuerySchema,
  listPickupJobsQuerySchema,
  updateJobStatusSchema,
} from "./jobs.dto"
import { getJob, listJobs, listPickupJobs, reportOutcome } from "./jobs.service"

/**
 * The rider app's job surface.
 *
 * Gated on `rider.jobs.*` rather than the admin's `parcels.*` keys, so a rider
 * token can never reach an admin operation, and the payload is scoped to the
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
    return c.json(response.success(await listJobs(c, auth.actor.riderId, c.req.valid("query"))))
  },
)

router.get(
  "/pickups",
  defineOperation(
    { id: "job.pickupList", audience: ["riders"], permissions: [PERMISSIONS.RIDER_JOBS_VIEW] },
    { method: "GET", path: "/jobs/pickups" },
  ),
  validateQuery(listPickupJobsQuerySchema),
  async (c) => {
    const auth = c.get("auth")
    if (!isRider(auth)) throw new DomainError(ERROR_CODES.FORBIDDEN, "This app is for riders")
    return c.json(
      response.success(await listPickupJobs(c, auth.actor.riderId, c.req.valid("query"))),
    )
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
    return c.json(response.success(await getJob(c, auth.actor.riderId, c.req.param("id"))))
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

    const job = await reportOutcome(c, {
      riderId: auth.actor.riderId,
      riderUserId: auth.actor.userId,
      parcelId: c.req.param("id"),
      input: c.req.valid("json"),
    })

    return c.json(response.success(job))
  },
)

/**
 * Location ping. Declared before `/:id` reads and `/:id/status` so a future
 * `POST /jobs/:id/...` cannot shadow it.
 *
 * The rider is taken from the token and never from the body (see
 * `reportLocationSchema`), and the gate is `rider.location.update` rather than a
 * `jobs` key: pushing a position is not job work, so a permission review of the
 * jobs surface does not accidentally imply it.
 */
router.post(
  "/locations",
  defineOperation(
    {
      id: "job.recordLocation",
      audience: ["riders"],
      permissions: [PERMISSIONS.RIDER_LOCATION_UPDATE],
    },
    { method: "POST", path: "/jobs/locations" },
  ),
  validateJson(reportLocationSchema),
  async (c) => {
    const auth = c.get("auth")
    if (!isRider(auth)) {
      throw new DomainError(ERROR_CODES.FORBIDDEN, "This app is for riders")
    }
    const fix = c.req.valid("json")
    const location = await recordRiderLocation(c, auth.actor.riderId, fix)
    return c.json(response.success(location), 201)
  },
)

router.get(
  "/:id/proofs",
  defineOperation(
    { id: "job.listProofs", audience: ["riders"], permissions: [PERMISSIONS.RIDER_JOBS_VIEW] },
    { method: "GET", path: "/jobs/:id/proofs" },
  ),
  validateParam(jobIdParamSchema),
  async (c) => {
    const auth = c.get("auth")
    if (!isRider(auth)) {
      throw new DomainError(ERROR_CODES.FORBIDDEN, "This app is for riders")
    }
    return c.json(response.success(await listJobProofs(c, auth.actor.riderId, c.req.param("id"))))
  },
)

/**
 * Proof capture. `parcelId` is the public identifier; the attempt is resolved
 * from the caller's own rows, so a rider can never file a proof against
 * another rider's delivery. `deliveryId` never appears in the body — the id
 * the rider knows is the parcel's, and the attempt is a server-side fact.
 */
router.post(
  "/proofs",
  defineOperation(
    { id: "job.submitProof", audience: ["riders"], permissions: [PERMISSIONS.RIDER_PROOF_SUBMIT] },
    { method: "POST", path: "/jobs/proofs" },
  ),
  validateJson(submitProofSchema),
  async (c) => {
    const auth = c.get("auth")
    if (!isRider(auth)) {
      throw new DomainError(ERROR_CODES.FORBIDDEN, "This app is for riders")
    }
    const proof = await submitProof(c, auth.actor.riderId, c.req.valid("json"))
    return c.json(response.success(proof), 201)
  },
)

export default router
