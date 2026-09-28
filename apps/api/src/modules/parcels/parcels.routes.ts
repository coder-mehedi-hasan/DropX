import { ERROR_CODES, DomainError, validateJson, validateParam, validateQuery } from "../../core"
import { response } from "../../core/http"
import { PERMISSIONS } from "../../shared/auth/permissions"
import { actorId, isCustomer, scopeFromAuth } from "../../shared/auth/auth-context"
import { defineOperation } from "../../shared/auth/policy"
import type { AppEnv } from "../../types/env"
import { Hono } from "hono"

import {
  PARCEL_SEARCH_COLUMNS,
  PARCEL_SORT_COLUMNS,
  cancelParcelSchema,
  createOwnParcelSchema,
  createParcelSchema,
  listParcelsQuerySchema,
  parcelIdParamSchema,
  updateParcelStatusSchema,
} from "./parcels.dto"
import * as parcels from "./parcels.service"

/**
 * Transport only. Every handler validates, delegates, and shapes the response —
 * no SQL, no business rules.
 *
 * Staff and customer surfaces are separate routes: a customer token must never
 * reach a staff operation, and the audience/permission policy enforces that
 * rather than trusting a hidden UI button.
 */
const router = new Hono<AppEnv>()

const idParam = validateParam(parcelIdParamSchema)

// --- staff -----------------------------------------------------------------

router.get(
  "/",
  defineOperation(
    { id: "parcel.list", audience: ["admin"], permissions: [PERMISSIONS.PARCELS_VIEW] },
    { method: "GET", path: "/parcels" },
  ),
  validateQuery(listParcelsQuerySchema),
  async (c) => {
    const page = await parcels.listParcelsForStaff(
      scopeFromAuth(c.get("auth")),
      c.req.valid("query"),
      PARCEL_SORT_COLUMNS,
      PARCEL_SEARCH_COLUMNS,
    )
    return c.json(response.success(page))
  },
)

router.get(
  "/:id",
  defineOperation(
    { id: "parcel.read", audience: ["admin"], permissions: [PERMISSIONS.PARCELS_VIEW] },
    { method: "GET", path: "/parcels/:id" },
  ),
  idParam,
  async (c) => {
    const parcel = await parcels.getParcelForStaff(scopeFromAuth(c.get("auth")), c.req.param("id"))
    const items = await parcels.getParcelItems(parcel.id)
    return c.json(response.success({ ...parcel, items }))
  },
)

router.post(
  "/",
  defineOperation(
    { id: "parcel.create", audience: ["admin"], permissions: [PERMISSIONS.PARCELS_CREATE] },
    { method: "POST", path: "/parcels" },
  ),
  validateJson(createParcelSchema),
  async (c) => {
    const input = c.req.valid("json")
    const auth = c.get("auth")

    if (!input.senderCustomerId) {
      throw new DomainError(ERROR_CODES.VALIDATION_FAILED, "senderCustomerId is required", {
        details: [{ field: "senderCustomerId", message: "Pick the customer sending the parcel" }],
      })
    }

    const parcel = await parcels.createParcel({
      senderCustomerId: input.senderCustomerId,
      originZoneId: input.originZoneId,
      input,
      actorId: actorId(auth),
    })

    return c.json(response.success(parcel, 201), 201)
  },
)

router.patch(
  "/:id/status",
  defineOperation(
    { id: "parcel.updateStatus", audience: ["admin"], permissions: [PERMISSIONS.PARCELS_UPDATE] },
    { method: "PATCH", path: "/parcels/:id/status" },
  ),
  idParam,
  validateJson(updateParcelStatusSchema),
  async (c) => {
    const input = c.req.valid("json")

    const parcel = await parcels.updateParcelStatus({
      parcelId: c.req.param("id"),
      status: input.status,
      reason: input.reason,
      hubId: input.hubId,
      scope: scopeFromAuth(c.get("auth")),
      actorId: actorId(c.get("auth")),
    })

    return c.json(response.success(parcel))
  },
)

router.post(
  "/:id/cancel",
  defineOperation(
    { id: "parcel.cancel", audience: ["admin"], permissions: [PERMISSIONS.PARCELS_CANCEL] },
    { method: "POST", path: "/parcels/:id/cancel" },
  ),
  idParam,
  validateJson(cancelParcelSchema),
  async (c) => {
    const parcel = await parcels.updateParcelStatus({
      parcelId: c.req.param("id"),
      status: "CANCELLED",
      reason: c.req.valid("json").reason,
      scope: scopeFromAuth(c.get("auth")),
      actorId: actorId(c.get("auth")),
    })

    return c.json(response.success(parcel))
  },
)

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
