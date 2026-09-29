import { ERROR_CODES, DomainError, validateJson, validateParam, validateQuery } from "../../core"
import { response } from "../../core/http"
import { isCustomer } from "../../shared/auth/auth-context"
import { defineOperation } from "../../shared/auth/policy"
import type { AppEnv } from "../../types/env"
import { Hono } from "hono"

import {
  PARCEL_SORT_COLUMNS,
  createOwnParcelSchema,
  listParcelsQuerySchema,
  parcelIdParamSchema,
} from "./parcels.dto"
import * as parcels from "./parcels.service"

/**
 * Transport only. Every handler validates, delegates, and shapes the response —
 * no SQL, no business rules.
 *
 * The customer portal surface only. Staff operations live in the admin surface
 * (`modules/admin/`) and are declared in its registry, so a customer token can
 * never reach them — the `audience` check enforces that rather than trusting a
 * hidden UI button. The `mine` path prefix says "scoped to the session"; the
 * `admin` mount is a different prefix entirely, not a different flag on the same
 * route.
 */
const router = new Hono<AppEnv>()

const idParam = validateParam(parcelIdParamSchema)

// --- customer portal -------------------------------------------------------

router.get(
  "/mine/list",
  defineOperation(
    { id: "parcel.listOwn", audience: ["web"], requiresActiveCustomer: true },
    { method: "GET", path: "/parcels/mine/list" },
  ),
  validateQuery(listParcelsQuerySchema),
  async (c) => {
    const auth = c.get("auth")
    if (!isCustomer(auth)) {
      throw new DomainError(ERROR_CODES.UNAUTHENTICATED, "Please sign in to continue")
    }

    const page = await parcels.listParcelsForCustomerPortal(
      auth.actor.customerId,
      c.req.valid("query"),
      PARCEL_SORT_COLUMNS,
      ["p.tracking_number"],
    )

    return c.json(response.success(page))
  },
)

router.get(
  "/mine/:id",
  defineOperation(
    { id: "parcel.readOwn", audience: ["web"], requiresActiveCustomer: true },
    { method: "GET", path: "/parcels/mine/:id" },
  ),
  idParam,
  async (c) => {
    const auth = c.get("auth")
    if (!isCustomer(auth)) {
      throw new DomainError(ERROR_CODES.UNAUTHENTICATED, "Please sign in to continue")
    }

    const parcel = await parcels.getParcelForCustomer(auth.actor.customerId, c.req.param("id"))
    const items = await parcels.getParcelItems(parcel.id)
    return c.json(response.success({ ...parcel, items }))
  },
)

router.post(
  "/mine",
  defineOperation(
    { id: "parcel.createOwn", audience: ["web"], requiresActiveCustomer: true },
    { method: "POST", path: "/parcels/mine" },
  ),
  validateJson(createOwnParcelSchema),
  async (c) => {
    const auth = c.get("auth")
    if (!isCustomer(auth)) {
      throw new DomainError(ERROR_CODES.UNAUTHENTICATED, "Please sign in to continue")
    }

    const input = c.req.valid("json")

    // The sender is the session, never the request body — `createOwnParcelSchema`
    // does not even accept the field.
    const parcel = await parcels.createParcel({
      senderCustomerId: auth.actor.customerId,
      originZoneId: input.originZoneId,
      input: { ...input, senderCustomerId: auth.actor.customerId },
      actorId: null,
    })

    return c.json(response.success(parcel, 201), 201)
  },
)

export default router
