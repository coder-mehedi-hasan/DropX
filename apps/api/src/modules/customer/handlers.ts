import { ERROR_CODES, DomainError } from "../../core"
import { response } from "../../core/http"
import { isCustomer } from "../../shared/auth/auth-context"
import type { SurfaceHandlers } from "../../shared/auth/surface"
import * as parcels from "../parcels/parcels.service"
import type { CUSTOMER_SURFACE } from "./registry"

/**
 * Customer-portal behaviour.
 *
 * The bodies are the ones that used to live in `parcels.routes.ts`. What moved
 * out of them is `defineOperation`, the validators, and the `isCustomer` guard's
 * HTTP framing — the registry declares the policy (`audience: ["web"]` plus
 * `requiresActiveCustomer`), and `mountSurface` mounts these behind it.
 *
 * The `isCustomer` check that remains is not redundant with the policy. The
 * policy's `audience` decides whether a *token* may be used here; this asks
 * whether the actor it resolved actually is a customer session, which is what
 * gives `auth.actor.customerId` a type that is not `null | undefined`.
 */
export const customerHandlers: SurfaceHandlers<typeof CUSTOMER_SURFACE> = {
  parcels: {
    list: async (c) => {
      const auth = c.get("auth")
      if (!isCustomer(auth)) {
        throw new DomainError(ERROR_CODES.UNAUTHENTICATED, "Please sign in to continue")
      }

      const page = await parcels.listParcelsForCustomerPortal(
        c,
        auth.actor.customerId,
        c.req.valid("query"),
        ["p.tracking_number"],
      )

      return c.json(response.success(page))
    },

    read: async (c) => {
      const auth = c.get("auth")
      if (!isCustomer(auth)) {
        throw new DomainError(ERROR_CODES.UNAUTHENTICATED, "Please sign in to continue")
      }

      const parcel = await parcels.getParcelForCustomer(
        c,
        auth.actor.customerId,
        c.req.valid("param").id,
      )
      const items = await parcels.getParcelItems(c, parcel.id)
      return c.json(response.success({ ...parcel, items }))
    },

    create: async (c) => {
      const auth = c.get("auth")
      if (!isCustomer(auth)) {
        throw new DomainError(ERROR_CODES.UNAUTHENTICATED, "Please sign in to continue")
      }

      const input = c.req.valid("json")

      // The sender is the session, never the request body —
      // `createOwnParcelSchema` does not even accept the field.
      const parcel = await parcels.createParcel(c, {
        senderCustomerId: auth.actor.customerId,
        originZoneId: input.originZoneId,
        input: { ...input, senderCustomerId: auth.actor.customerId },
        actorId: null,
      })

      return c.json(response.success(parcel, 201), 201)
    },
  },
}
