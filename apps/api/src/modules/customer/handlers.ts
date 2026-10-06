import { ERROR_CODES, DomainError } from "../../core"
import { response } from "../../core/http"
import { isCustomer, scopeFromAuth } from "../../shared/auth/auth-context"
import type { SurfaceHandlers } from "../../shared/auth/surface"
import * as parcels from "../parcels/parcels.service"
import * as reference from "../reference/reference.service"
import * as locations from "../locations/locations.service"
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
  reference: {
    listHubs: async (c) =>
      c.json(
        response.success(
          await reference.listHubs(c, scopeFromAuth(c.get("auth")), {
            ...c.req.valid("query"),
            status: "ACTIVE",
          }),
        ),
      ),
    listZones: async (c) =>
      c.json(response.success(await reference.listZones(c, c.req.valid("query")))),
    searchRecipients: async (c) =>
      c.json(response.success(await reference.searchCustomers(c, c.req.valid("query"), "ACTIVE"))),
  },

  locations: {
    listCities: async (c) =>
      c.json(response.success(await locations.listCitiesForCustomer(c, c.req.valid("query")))),
    listZones: async (c) =>
      c.json(
        response.success(
          await locations.listZonesForCity(
            c,
            c.req.valid("param").cityId,
            c.req.valid("query"),
          ),
        ),
      ),
    listAreas: async (c) =>
      c.json(
        response.success(
          await locations.listAreasForZone(c, c.req.valid("param").zoneId, c.req.valid("query")),
        ),
      ),
  },
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
      const addresses = await parcels.getParcelAddresses(c, parcel.id)
      return c.json(response.success({ ...parcel, items, addresses }))
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
        input: { ...input, senderCustomerId: auth.actor.customerId },
        actorId: null,
      })

      const items = await parcels.getParcelItems(c, parcel.id)
      const addresses = await parcels.getParcelAddresses(c, parcel.id)
      return c.json(response.success({ ...parcel, items, addresses }, 201), 201)
    },
  },
}
