import { ERROR_CODES, DomainError } from "../../core"
import { response } from "../../core/http"
import { actorId, scopeFromAuth } from "../../shared/auth/auth-context"
import type { SurfaceHandlers } from "../../shared/auth/surface"
import { PARCEL_SEARCH_COLUMNS } from "../parcels/parcels.dto"
import * as parcels from "../parcels/parcels.service"
import * as org from "../org/org.service"
import * as pickups from "../pickups/pickups.service"
import * as deliveries from "../deliveries/deliveries.service"
import * as deliveryProofs from "../deliveries/delivery-proofs.service"
import * as transfers from "../transfers/transfers.service"
import * as reference from "../reference/reference.service"
import * as zones from "../zones/zones.service"
import * as vehicles from "../vehicles/vehicles.service"
import * as riderLocations from "../riders/rider-locations.service"
import * as riders from "../riders/riders.service"
import * as bootstrap from "./bootstrap.service"
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
        c,
        scopeFromAuth(c.get("auth")),
        c.req.valid("query"),
        PARCEL_SEARCH_COLUMNS,
      )
      return c.json(response.success(page))
    },

    read: async (c) => {
      const parcel = await parcels.getParcelForStaff(
        c,
        scopeFromAuth(c.get("auth")),
        c.req.valid("param").id,
      )
      const items = await parcels.getParcelItems(c, parcel.id)
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

      const parcel = await parcels.createParcel(c, {
        senderCustomerId: input.senderCustomerId,
        originZoneId: input.originZoneId,
        input,
        actorId: actorId(auth),
      })

      return c.json(response.success(parcel, 201), 201)
    },

    updateStatus: async (c) => {
      const input = c.req.valid("json")

      const parcel = await parcels.updateParcelStatus(c, {
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
      const parcel = await parcels.updateParcelStatus(c, {
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
    listBranches: async (c) => {
      const page = await reference.listBranches(c, c.req.valid("query"))
      return c.json(response.success(page))
    },

    listHubs: async (c) => {
      const page = await reference.listHubs(c, scopeFromAuth(c.get("auth")), c.req.valid("query"))
      return c.json(response.success(page))
    },

    listZones: async (c) => {
      const page = await reference.listZones(c, c.req.valid("query"))
      return c.json(response.success(page))
    },

    searchCustomers: async (c) => {
      const page = await reference.searchCustomers(c, c.req.valid("query"))
      return c.json(response.success(page))
    },
  },

  /**
   * Organization: branches and hubs. Thin transport — the service owns the
   * FK-shaped failure (creating a hub against a missing branch surfaces as
   * `NOT_FOUND` with the branch id in the detail, not a driver message), and
   * nothing here decides scoping. Reads are company-wide by design; the policy
   * on each operation is what gates who may touch what.
   */
  org: {
    listBranches: async (c) => {
      const page = await org.listBranches(c, c.req.valid("query"))
      return c.json(response.success(page))
    },

    readBranch: async (c) => {
      const branch = await org.getBranch(c, c.req.valid("param").id)
      return c.json(response.success(branch))
    },

    createBranch: async (c) => {
      const branch = await org.createBranch(c, c.req.valid("json"))
      return c.json(response.success(branch), 201)
    },

    updateBranch: async (c) => {
      const branch = await org.updateBranch(c, c.req.valid("param").id, c.req.valid("json"))
      return c.json(response.success(branch))
    },

    listHubs: async (c) => {
      const page = await org.listHubs(c, c.req.valid("query"))
      return c.json(response.success(page))
    },

    readHub: async (c) => {
      const hub = await org.getHub(c, c.req.valid("param").id)
      return c.json(response.success(hub))
    },

    createHub: async (c) => {
      const hub = await org.createHub(c, c.req.valid("json"))
      return c.json(response.success(hub), 201)
    },

    updateHub: async (c) => {
      const hub = await org.updateHub(c, c.req.valid("param").id, c.req.valid("json"))
      return c.json(response.success(hub))
    },
  },

  bootstrap: {
    create: async (c) => {
      const admin = await bootstrap.bootstrapAdmin(c, c.req.valid("json"))
      return c.json(response.success(admin), 201)
    },
  },

  zones: {
    list: async (c) => {
      const page = await zones.listZones(c, c.req.valid("query"))
      return c.json(response.success(page))
    },

    read: async (c) => {
      const zone = await zones.getZone(c, c.req.valid("param").id)
      return c.json(response.success(zone))
    },

    create: async (c) => {
      const zone = await zones.createZone(c, c.req.valid("json"))
      return c.json(response.success(zone), 201)
    },

    update: async (c) => {
      const zone = await zones.updateZone(c, c.req.valid("param").id, c.req.valid("json"))
      return c.json(response.success(zone))
    },
  },

  vehicles: {
    list: async (c) => {
      const page = await vehicles.listVehicles(c, c.req.valid("query"))
      return c.json(response.success(page))
    },

    read: async (c) => {
      const vehicle = await vehicles.getVehicle(c, c.req.valid("param").id)
      return c.json(response.success(vehicle))
    },

    create: async (c) => {
      const vehicle = await vehicles.createVehicle(c, c.req.valid("json"))
      return c.json(response.success(vehicle), 201)
    },

    update: async (c) => {
      const vehicle = await vehicles.updateVehicle(c, c.req.valid("param").id, c.req.valid("json"))
      return c.json(response.success(vehicle))
    },

    deactivate: async (c) => {
      const vehicle = await vehicles.deactivateVehicle(c, c.req.valid("param").id)
      return c.json(response.success(vehicle))
    },
  },

  riders: {
    list: async (c) => {
      const page = await riders.listRiders(c, c.req.valid("query"))
      return c.json(response.success(page))
    },

    read: async (c) => {
      const rider = await riders.getRider(c, c.req.valid("param").id)
      return c.json(response.success(rider))
    },

    create: async (c) => {
      const rider = await riders.createRider(c, c.req.valid("json"))
      return c.json(response.success(rider), 201)
    },

    update: async (c) => {
      const rider = await riders.updateRider(c, c.req.valid("param").id, c.req.valid("json"))
      return c.json(response.success(rider))
    },

    setStatus: async (c) => {
      const rider = await riders.setRiderStatus(
        c,
        c.req.valid("param").id,
        c.req.valid("json").status,
      )
      return c.json(response.success(rider))
    },
  },

  riderLocations: {
    list: async (c) => {
      const page = await riderLocations.listRiderLocations(c, c.req.valid("query"))
      return c.json(response.success(page))
    },
  },

  pickups: {
    list: async (c) => {
      const page = await pickups.listPickups(c, scopeFromAuth(c.get("auth")), c.req.valid("query"))
      return c.json(response.success(page))
    },

    read: async (c) => {
      const pickup = await pickups.getPickup(
        c,
        scopeFromAuth(c.get("auth")),
        c.req.valid("param").id,
      )
      return c.json(response.success(pickup))
    },

    create: async (c) => {
      const auth = c.get("auth")
      const pickup = await pickups.createPickup(c, {
        scope: scopeFromAuth(auth),
        actorId: actorId(auth),
        input: c.req.valid("json"),
      })
      return c.json(response.success(pickup), 201)
    },

    assign: async (c) => {
      const auth = c.get("auth")
      const pickup = await pickups.assignPickup(c, {
        scope: scopeFromAuth(auth),
        actorId: actorId(auth),
        pickupId: c.req.valid("param").id,
        input: c.req.valid("json"),
      })
      return c.json(response.success(pickup))
    },

    updateStatus: async (c) => {
      const auth = c.get("auth")
      const pickup = await pickups.updatePickupStatus(c, {
        scope: scopeFromAuth(auth),
        actorId: actorId(auth),
        pickupId: c.req.valid("param").id,
        input: c.req.valid("json"),
      })
      return c.json(response.success(pickup))
    },
  },

  deliveryProofs: {
    list: async (c) => {
      const page = await deliveryProofs.listDeliveryProofs(
        c,
        scopeFromAuth(c.get("auth")),
        c.req.valid("query"),
      )
      return c.json(response.success(page))
    },

    verify: async (c) => {
      const proof = await deliveryProofs.verifyDeliveryProof(
        c,
        scopeFromAuth(c.get("auth")),
        c.req.valid("param").id,
      )
      return c.json(response.success(proof))
    },
  },

  deliveries: {
    list: async (c) => {
      const page = await deliveries.listDeliveries(
        c,
        scopeFromAuth(c.get("auth")),
        c.req.valid("query"),
      )
      return c.json(response.success(page))
    },

    read: async (c) => {
      const delivery = await deliveries.getDelivery(
        c,
        scopeFromAuth(c.get("auth")),
        c.req.valid("param").id,
      )
      return c.json(response.success(delivery))
    },

    create: async (c) => {
      const auth = c.get("auth")
      const delivery = await deliveries.createDelivery(c, {
        scope: scopeFromAuth(auth),
        actorId: actorId(auth),
        input: c.req.valid("json"),
      })
      return c.json(response.success(delivery), 201)
    },

    reassign: async (c) => {
      const auth = c.get("auth")
      const delivery = await deliveries.reassignDelivery(c, {
        scope: scopeFromAuth(auth),
        actorId: actorId(auth),
        deliveryId: c.req.valid("param").id,
        input: c.req.valid("json"),
      })
      return c.json(response.success(delivery))
    },

    updateStatus: async (c) => {
      const auth = c.get("auth")
      const delivery = await deliveries.updateDeliveryStatus(c, {
        scope: scopeFromAuth(auth),
        actorId: actorId(auth),
        deliveryId: c.req.valid("param").id,
        input: c.req.valid("json"),
      })
      return c.json(response.success(delivery))
    },
  },

  transfers: {
    list: async (c) => {
      const page = await transfers.listTransfers(
        c,
        scopeFromAuth(c.get("auth")),
        c.req.valid("query"),
      )
      return c.json(response.success(page))
    },

    read: async (c) => {
      const transfer = await transfers.getTransfer(
        c,
        scopeFromAuth(c.get("auth")),
        c.req.valid("param").id,
      )
      return c.json(response.success(transfer))
    },

    create: async (c) => {
      const transfer = await transfers.createTransfer(c, {
        scope: scopeFromAuth(c.get("auth")),
        input: c.req.valid("json"),
      })
      return c.json(response.success(transfer), 201)
    },

    update: async (c) => {
      const transfer = await transfers.updateTransfer(c, {
        scope: scopeFromAuth(c.get("auth")),
        transferId: c.req.valid("param").id,
        input: c.req.valid("json"),
      })
      return c.json(response.success(transfer))
    },

    delete: async (c) => {
      await transfers.deleteTransfer(c, {
        scope: scopeFromAuth(c.get("auth")),
        transferId: c.req.valid("param").id,
      })
      // A 204 must not carry a body (RFC 9110), which is why the registry entry
      // for `delete` declares no response schema.
      return c.body(null, 204)
    },

    updateStatus: async (c) => {
      const auth = c.get("auth")
      const transfer = await transfers.updateTransferStatus(c, {
        scope: scopeFromAuth(auth),
        actorId: actorId(auth),
        transferId: c.req.valid("param").id,
        input: c.req.valid("json"),
      })
      return c.json(response.success(transfer))
    },

    manifestList: async (c) => {
      const manifest = await transfers.listTransferManifest(
        c,
        scopeFromAuth(c.get("auth")),
        c.req.valid("param").id,
      )
      return c.json(response.success(manifest))
    },

    manifestReplace: async (c) => {
      const manifest = await transfers.replaceManifest(c, {
        scope: scopeFromAuth(c.get("auth")),
        transferId: c.req.valid("param").id,
        input: c.req.valid("json"),
      })
      return c.json(response.success(manifest))
    },
  },
}
