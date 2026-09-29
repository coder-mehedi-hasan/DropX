import { ERROR_CODES, DomainError } from "../../core"
import { response } from "../../core/http"
import { actorId, scopeFromAuth } from "../../shared/auth/auth-context"
import type { SurfaceHandlers } from "../../shared/auth/surface"
import { PARCEL_SEARCH_COLUMNS, PARCEL_SORT_COLUMNS } from "../parcels/parcels.dto"
import * as parcels from "../parcels/parcels.service"
import * as reference from "../reference/reference.service"
import type { ADMIN_SURFACE } from "./registry"

/**
 * Admin behaviour.
 *
 * Every key here must have a matching entry in `./registry.ts`, and vice versa —
 * `mountSurface` checks that at boot. The bodies are the ones that used to live
 * in `parcels.routes.ts`; what moved out of them is `defineOperation` and the
 * validators, because the registry now declares both.
 *
 * The `SurfaceHandlers` annotation is what types `c`: `c.req.valid("json")` is
 * inferred from the `body` schema the registry declared, so a renamed DTO field
 * is a type error here as well as a boot failure there.
 */
export const adminHandlers: SurfaceHandlers<typeof ADMIN_SURFACE> = {
  parcels: {
    list: async (c) => {
      const page = await parcels.listParcelsForStaff(
        scopeFromAuth(c.get("auth")),
        c.req.valid("query"),
        PARCEL_SORT_COLUMNS,
        PARCEL_SEARCH_COLUMNS,
      )
      return c.json(response.success(page))
    },

    read: async (c) => {
      const parcel = await parcels.getParcelForStaff(
        scopeFromAuth(c.get("auth")),
        c.req.valid("param").id,
      )
      const items = await parcels.getParcelItems(parcel.id)
      return c.json(response.success({ ...parcel, items }))
    },

    create: async (c) => {
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

    updateStatus: async (c) => {
      const input = c.req.valid("json")

      const parcel = await parcels.updateParcelStatus({
        parcelId: c.req.valid("param").id,
        status: input.status,
        reason: input.reason,
        hubId: input.hubId,
        scope: scopeFromAuth(c.get("auth")),
        actorId: actorId(c.get("auth")),
      })

      return c.json(response.success(parcel))
    },

    cancel: async (c) => {
      const parcel = await parcels.updateParcelStatus({
        parcelId: c.req.valid("param").id,
        status: "CANCELLED",
        reason: c.req.valid("json").reason,
        scope: scopeFromAuth(c.get("auth")),
        actorId: actorId(c.get("auth")),
      })

      return c.json(response.success(parcel))
    },
  },

  /**
   * Reference reads. The handlers are one-liners because the service is: the
   * judgement is the caller's `Scope`, which comes from the token and is
   * resolved here, not from anything the client sent.
   */
  reference: {
    listHubs: async (c) => {
      const page = await reference.listHubs(scopeFromAuth(c.get("auth")), c.req.valid("query"))
      return c.json(response.success(page))
    },

    listZones: async (c) => {
      const page = await reference.listZones(c.req.valid("query"))
      return c.json(response.success(page))
    },

    searchCustomers: async (c) => {
      const page = await reference.searchCustomers(c.req.valid("query"))
      return c.json(response.success(page))
    },
  },
}
