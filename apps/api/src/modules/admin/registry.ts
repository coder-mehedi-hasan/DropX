import { PERMISSIONS } from "../../shared/auth/permissions"
import { defineSurface } from "../../shared/auth/surface"
import {
  branchRefResponseSchema,
  customerRefResponseSchema,
  hubRefResponseSchema,
  listBranchesQuerySchema,
  listHubsQuerySchema,
  listZonesQuerySchema,
  searchCustomersQuerySchema,
  zoneRefResponseSchema,
} from "../reference/reference.dto"
import {
  createZoneSchema as createZoneBody,
  listZonesQuerySchema as listZonesQuery,
  updateZoneSchema as updateZoneBody,
  zoneIdParamSchema as zoneIdParam,
  zoneResponseSchema as zoneResponse,
} from "../zones/zones.dto"
import {
  createVehicleSchema as createVehicleBody,
  listVehiclesQuerySchema as listVehiclesQuery,
  updateVehicleSchema as updateVehicleBody,
  vehicleIdParamSchema as vehicleIdParam,
  vehicleResponseSchema as vehicleResponse,
} from "../vehicles/vehicles.dto"
import {
  branchIdParamSchema as branchIdParam,
  branchResponseSchema as branchResponse,
  createBranchSchema as createBranchBody,
  createHubSchema as createHubBody,
  hubIdParamSchema as hubIdParam,
  hubResponseSchema as hubResponse,
  listBranchesQuerySchema as listBranchesQuery,
  listHubsQuerySchema as listHubsQuery,
  updateBranchSchema as updateBranchBody,
  updateHubSchema as updateHubBody,
} from "../org/org.dto"
import {
  cancelParcelSchema,
  createParcelSchema,
  listParcelsQuerySchema,
  parcelIdParamSchema,
  parcelResponseSchema,
  parcelWithItemsResponseSchema,
  updateParcelStatusSchema,
} from "../parcels/parcels.dto"
import {
  listRiderLocationsQuerySchema as listRiderLocationsQuery,
  riderLocationResponseSchema as riderLocationResponse,
} from "../riders/rider-locations.dto"
import {
  assignPickupSchema,
  createPickupSchema,
  listPickupsQuerySchema,
  pickupIdParamSchema,
  pickupResponseSchema,
  updatePickupStatusSchema,
} from "../pickups/pickups.dto"
import {
  deliveryProofIdParamSchema as deliveryProofIdParam,
  deliveryProofListItemSchema as deliveryProofListItem,
  deliveryProofResponseSchema as deliveryProofResponse,
  listDeliveryProofsQuerySchema as listDeliveryProofsQuery,
} from "../deliveries/delivery-proofs.dto"
import {
  createDeliverySchema as createDeliveryBody,
  deliveryIdParamSchema as deliveryIdParam,
  deliveryResponseSchema as deliveryResponse,
  listDeliveriesQuerySchema as listDeliveriesQuery,
  reassignDeliverySchema as reassignDeliveryBody,
  updateDeliveryStatusSchema as updateDeliveryStatusBody,
} from "../deliveries/deliveries.dto"
import {
  createTransferSchema as createTransferBody,
  listTransfersQuerySchema as listTransfersQuery,
  replaceTransferManifestSchema as replaceTransferManifestBody,
  transferIdParamSchema as transferIdParam,
  transferParcelListSchema as transferParcelList,
  transferListItemSchema as transferListItem,
  transferWithManifestResponseSchema as transferWithManifestResponse,
  updateTransferSchema as updateTransferBody,
  updateTransferStatusSchema as updateTransferStatusBody,
} from "../transfers/transfers.dto"
import {
  createRiderSchema as createRiderBody,
  listRidersQuerySchema as listRidersQuery,
  riderIdParamSchema as riderIdParam,
  riderResponseSchema as riderResponse,
  setRiderStatusSchema as setRiderStatusBody,
  updateRiderSchema as updateRiderBody,
} from "../riders/riders.dto"
import { bootstrapAdminResponseSchema, bootstrapAdminSchema } from "./bootstrap.dto"
import {
  listRiderApplicationsQuerySchema,
  riderApplicationIdParamSchema,
  riderApplicationResponseSchema,
  updateRiderApplicationSchema,
  approveRiderApplicationSchema,
  approveRiderApplicationResponseSchema,
} from "../rider-applications/rider-applications.dto"

/**
 * The admin surface — the whole contract for every staff operation.
 *
 * Each entry below is everything `openapi/paths/parcels.openapi.ts` used to say
 * about the five staff parcel operations, plus what only the route knew: the
 * policy, the validators, and the mount point. The operation id and the absolute
 * path are derived from `namespace`/`basePath`, so they cannot disagree with each
 * other or with what is served.
 *
 * Behaviour lives in `./handlers.ts`, keyed by `"{feature}.{key}"`. Adding an
 * operation is one entry here plus one handler; `mountSurface` refuses to boot
 * if those two ever fall out of step.
 */
export const ADMIN_SURFACE = defineSurface({
  namespace: "admin",
  basePath: "/admin",
  features: {
    parcels: {
      tag: "parcels",
      // Declared once, here, because the tag covers both surfaces. `parcels` is
      // the admin surface's staff half and the customer surface's self-service
      // half, and a tag is a document-level grouping — without an explicit
      // description the shared tag falls back to "Operations for parcel.", which
      // describes neither audience.
      tagDescription:
        "Parcel booking, the parcel lifecycle, and a customer's own parcel views — the staff surface under `/admin/parcels` and the self-service surface under `/customer/parcels`.",
      operations: {
        list: {
          method: "GET",
          path: "/parcels",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.PARCELS_VIEW] },
          summary: "List parcels (staff)",
          successDescription: "A page of parcels.",
          description:
            "Branch/hub-scoped list for staff. Ordering is limited to an allowlist of columns; an unknown `sortBy` is rejected rather than interpolated into SQL.",
          query: listParcelsQuerySchema,
          listNodes: parcelResponseSchema,
        },
        read: {
          method: "GET",
          path: "/parcels/:id",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.PARCELS_VIEW] },
          summary: "Read a parcel (staff)",
          successDescription: "The parcel.",
          description: "Full parcel with its items, scoped to the caller's branch/hubs.",
          params: parcelIdParamSchema,
          paramDescriptions: { id: "Parcel id." },
          response: parcelWithItemsResponseSchema,
          errors: { 404: "No such parcel in scope." },
        },
        create: {
          method: "POST",
          path: "/parcels",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.PARCELS_CREATE] },
          summary: "Create a parcel (staff)",
          successDescription: "Created.",
          description:
            "Books a parcel on a customer's behalf, so `senderCustomerId` is required. The delivery fee is quoted server-side from the destination zone and is never accepted from the client.",
          body: createParcelSchema,
          response: parcelWithItemsResponseSchema,
          successStatus: 201,
          errors: {
            422: "Validation failed, or no pricing rule covers the route/weight.",
          },
        },
        updateStatus: {
          method: "PATCH",
          path: "/parcels/:id/status",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.PARCELS_UPDATE] },
          summary: "Update parcel status (staff)",
          successDescription: "Updated.",
          description:
            "Advances the parcel lifecycle. A transition that is not legal from the current status is rejected with `INVALID_STATE_TRANSITION`.",
          params: parcelIdParamSchema,
          paramDescriptions: { id: "Parcel id." },
          body: updateParcelStatusSchema,
          response: parcelResponseSchema,
          errors: {
            404: "No such parcel in scope.",
            409: "The requested status transition is not allowed from the current status.",
          },
        },
        cancel: {
          method: "POST",
          path: "/parcels/:id/cancel",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.PARCELS_CANCEL] },
          summary: "Cancel a parcel (staff)",
          successDescription: "Cancelled.",
          description: "Cancels a parcel that has not been delivered yet. A reason is required.",
          params: parcelIdParamSchema,
          paramDescriptions: { id: "Parcel id." },
          body: cancelParcelSchema,
          response: parcelResponseSchema,
          errors: {
            404: "No such parcel in scope.",
            409: "The parcel cannot be cancelled from its current status.",
          },
        },
      },
    },

    /**
     * Pickups: collecting a parcel from a customer.
     *
     * A pickup has no hub of its own — it is a collection against one parcel, and
     * the parcel is what carries geography — so every read and both writes are
     * scoped through `COALESCE(parcels.current_hub_id, parcels.destination_hub_id)`.
     * That is why the list filter takes `hubId`: it filters on the parcel's hub,
     * which is the only hub a pickup has.
     *
     * `assign` is a separate operation from `updateStatus` on purpose, so
     * `pickups.assign` can be granted to dispatch without also handing over the
     * authority to fail, cancel, or re-status a pickup. It is a POST rather than a
     * PATCH because the rider id is in the body: `PATCH /pickups/:id` would
     * invite a client to think it could address the pickup itself.
     */
    pickups: {
      tag: "pickups",
      tagDescription:
        "Collections: raising a pickup for a parcel, assigning a rider to it, and moving it through to collected.",
      operations: {
        list: {
          method: "GET",
          path: "/pickups",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.PICKUPS_VIEW] },
          summary: "List pickups",
          successDescription: "A page of pickups.",
          description:
            "Branch/hub-scoped through the parcel each pickup belongs to. Ordering is limited to an allowlist of columns; an unknown `sortBy` is rejected rather than interpolated into SQL.",
          query: listPickupsQuerySchema,
          listNodes: pickupResponseSchema,
        },
        read: {
          method: "GET",
          path: "/pickups/:id",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.PICKUPS_VIEW] },
          summary: "Read a pickup",
          successDescription: "The pickup.",
          params: pickupIdParamSchema,
          paramDescriptions: { id: "Pickup id." },
          response: pickupResponseSchema,
          errors: { 404: "No such pickup in scope." },
        },
        create: {
          method: "POST",
          path: "/pickups",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.PICKUPS_MANAGE] },
          summary: "Create a pickup",
          successDescription: "Created.",
          description:
            "Raises a collection for a parcel. `parcelId` accepts either the parcel id or its tracking number — the only string a customer can read out over the phone. `requestedBy` is the authenticated actor and is never read from the body, and a parcel may have only one unfinished pickup at a time.",
          body: createPickupSchema,
          response: pickupResponseSchema,
          successStatus: 201,
          errors: {
            404: "No such parcel in scope.",
            409: "The parcel already has an unfinished pickup.",
            422: "Validation failed, or the chosen status needs a reason.",
          },
        },
        assign: {
          method: "POST",
          path: "/pickups/:id/assign",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.PICKUPS_ASSIGN] },
          summary: "Assign a rider to a pickup",
          successDescription: "Assigned.",
          description:
            "Assigns a rider and moves the pickup to `ASSIGNED`. Reassigning is a two-step affair — move the pickup back to `REQUESTED` first — so an accidental second dispatch cannot silently replace a rider who was told to turn up.",
          params: pickupIdParamSchema,
          paramDescriptions: { id: "Pickup id." },
          body: assignPickupSchema,
          response: pickupResponseSchema,
          errors: {
            404: "No such pickup in scope, or no such rider.",
            409: "The pickup cannot be assigned from its current status.",
          },
        },
        updateStatus: {
          method: "PATCH",
          path: "/pickups/:id/status",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.PICKUPS_MANAGE] },
          summary: "Update pickup status",
          successDescription: "Updated.",
          description:
            "Moves the pickup along its lifecycle. `PICKED_UP` also stamps `pickedUpAt` and moves the parcel to `PICKED_UP`, both in the same transaction.",
          params: pickupIdParamSchema,
          paramDescriptions: { id: "Pickup id." },
          body: updatePickupStatusSchema,
          response: pickupResponseSchema,
          errors: {
            404: "No such pickup in scope.",
            409: "The requested status transition is not allowed from the current status.",
            422: "Validation failed. `FAILED` and `CANCELLED` require a reason.",
          },
        },
      },
    },

    /**
     * Delivery proofs: the artefact recorded at the door. Riders file proofs
     * through the jobs surface; admin reads them and confirms them.
     */
    deliveryProofs: {
      tag: "delivery-proofs",
      tagDescription:
        "Proofs of delivery: what a rider recorded at handover, and whether dispatch has confirmed it.",
      operations: {
        list: {
          method: "GET",
          path: "/delivery-proofs",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.DELIVERIES_VIEW] },
          summary: "List delivery proofs",
          successDescription: "A page of proofs.",
          description:
            "Scoped through the delivery attempt's hub. Filter by type, verified state, delivery, or free text over tracking number, rider, and hub.",
          query: listDeliveryProofsQuery,
          listNodes: deliveryProofListItem,
        },
        verify: {
          method: "PATCH",
          path: "/delivery-proofs/:id/verify",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.DELIVERIES_MANAGE] },
          summary: "Verify a delivery proof",
          successDescription: "Verified.",
          description:
            "Stamps `verified_at`. The rider does not vouch for their own artefact — confirmation is an office act, and a second call is a 409 rather than a silent overwrite of the original timestamp.",
          params: deliveryProofIdParam,
          paramDescriptions: { id: "Proof id." },
          response: deliveryProofResponse,
          errors: {
            404: "No such proof in scope.",
            409: "The proof is already verified.",
          },
        },
      },
    },

    /**
     * Deliveries: the rider's last-mile attempts, created and overseen by
     * dispatch.
     *
     * A delivery is the rider's leg of one parcel, and there is exactly one
     * open attempt per parcel at a time — retries are new rows with the next
     * `attempt_no`, never reopened ones. Reads and writes are scoped through
     * `d.hub_id` (the attempt's own hub), while create additionally locks the
     * parcel and takes its hub from the parcel row, so the address a dispatcher
     * types can never land on the wrong hub.
     *
     * `create` is gated on `deliveries.assign` because raising an attempt *is*
     * assigning a rider — there is no draft attempt without one. `reassign`
     * shares that key: dispatch owns the rider on the attempt. `updateStatus`
     * is `deliveries.manage`: the rider owns the outcome transitions in
     * normal running, so the admin side is reserved for overrides and
     * cancellations, and a cancellation releases the parcel back to its hub.
     */
    deliveries: {
      tag: "deliveries",
      tagDescription:
        "Last-mile attempts: opening an attempt for a parcel, reassigning its rider, and overriding its status.",
      operations: {
        list: {
          method: "GET",
          path: "/deliveries",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.DELIVERIES_VIEW] },
          summary: "List deliveries",
          successDescription: "A page of deliveries.",
          description:
            "Scoped by the attempt's hub. Ordering is limited to an allowlist of columns; an unknown `sortBy` is rejected rather than interpolated into SQL.",
          query: listDeliveriesQuery,
          listNodes: deliveryResponse,
        },
        read: {
          method: "GET",
          path: "/deliveries/:id",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.DELIVERIES_VIEW] },
          summary: "Read a delivery",
          successDescription: "The delivery.",
          params: deliveryIdParam,
          paramDescriptions: { id: "Delivery id." },
          response: deliveryResponse,
          errors: { 404: "No such delivery in scope." },
        },
        create: {
          method: "POST",
          path: "/deliveries",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.DELIVERIES_ASSIGN] },
          summary: "Create a delivery attempt",
          successDescription: "Created.",
          description:
            "Opens an attempt for a parcel: locks the parcel, checks there is no open attempt, and opens row `attempt_no + 1`. `parcelId` accepts either the parcel id or its tracking number — the only string a human has. The parcel must be `AT_HUB` or `FAILED`, and the rider must not be suspended. The hub is derived from the parcel, never taken from the body.",
          body: createDeliveryBody,
          response: deliveryResponse,
          successStatus: 201,
          errors: {
            404: "No such parcel in scope, or no such rider.",
            409: "The parcel already has an open delivery attempt.",
            422: "Validation failed, or the parcel is not in a dispatchable status.",
          },
        },
        reassign: {
          method: "PATCH",
          path: "/deliveries/:id",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.DELIVERIES_ASSIGN] },
          summary: "Reassign a delivery attempt",
          successDescription: "Reassigned.",
          description:
            "Swaps the rider on the same attempt. Only allowed while the attempt is still `ASSIGNED` — once it is out for delivery, a rider swap is a status event, not an edit.",
          params: deliveryIdParam,
          paramDescriptions: { id: "Delivery id." },
          body: reassignDeliveryBody,
          response: deliveryResponse,
          errors: {
            404: "No such delivery in scope, or no such rider.",
            409: "Only an attempt that has not started can be reassigned.",
          },
        },
        updateStatus: {
          method: "PATCH",
          path: "/deliveries/:id/status",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.DELIVERIES_MANAGE] },
          summary: "Update delivery status",
          successDescription: "Updated.",
          description:
            "Moves the attempt along its lifecycle, in the same transaction as the parcel: `DELIVERED`/`FAILED`/`RETURNED`/`OUT_FOR_DELIVERY` move the parcel to match, `CANCELLED` releases the parcel back to `AT_HUB`. The rider's own outcome reporting flows through the jobs endpoint, not this one.",
          params: deliveryIdParam,
          paramDescriptions: { id: "Delivery id." },
          body: updateDeliveryStatusBody,
          response: deliveryResponse,
          errors: {
            404: "No such delivery in scope.",
            409: "The requested status transition is not allowed from the current status.",
            422: "Validation failed. `FAILED` and `CANCELLED` require a reason.",
          },
        },
      },
    },

    /**
     * Transfers: moving parcels between two hubs.
     *
     * Two things here are unlike the rest of this surface, and both are forced by
     * the domain rather than chosen:
     *
     * - **A transfer has two ends, so it is scoped by either.** `transfers.manage`
     *   is checked against the origin hub alone — the hub that loads the truck is
     *   the one that owns it — while every read matches `from_hub` **or** `to_hub`,
     *   because a hub must see the transfer it is about to unload as well as the
     *   one it is loading. `AND` would hide inbound trucks; the asymmetry is in
     *   `transfers.repository.ts` and is the part to read before changing it.
     * - **The manifest is sealed at departure.** `PUT /transfers/:id/parcels`
     *   replaces the load list freely until the transfer is `IN_TRANSIT`, after
     *   which the list is a record of what was on the truck. There is no
     *   "cancel in transit" for the same reason: the parcels are on a vehicle this
     *   system does not track.
     *
     * `delete` exists but only bites on an empty `PLANNED` transfer — a draft.
     * Anything with a manifest is cancelled instead, so the record of what was
     * loaded onto a truck is never destroyed.
     */
    transfers: {
      tag: "transfers",
      tagDescription:
        "Hub-to-hub transfers: planning a run, loading its manifest, departing, and arriving.",
      operations: {
        list: {
          method: "GET",
          path: "/transfers",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.TRANSFERS_VIEW] },
          summary: "List transfers",
          successDescription: "A page of transfers.",
          description:
            "Scoped by either hub, so a hub sees what it is loading and what is arriving. The `hubId` filter matches either end too. Ordering is limited to an allowlist of columns.",
          query: listTransfersQuery,
          listNodes: transferListItem,
        },
        read: {
          method: "GET",
          path: "/transfers/:id",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.TRANSFERS_VIEW] },
          summary: "Read a transfer",
          successDescription: "The transfer, with its manifest.",
          description:
            "One request for the whole screen: the transfer, both hub names, and every parcel on it with its load and unload timestamps.",
          params: transferIdParam,
          paramDescriptions: { id: "Transfer id." },
          response: transferWithManifestResponse,
          errors: { 404: "No such transfer in scope." },
        },
        create: {
          method: "POST",
          path: "/transfers",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.TRANSFERS_MANAGE] },
          summary: "Create a transfer",
          successDescription: "Created.",
          description:
            "Plans a hub-to-hub run. `transferNumber` is generated server-side and never accepted from a client. `driverRef` is a **staff** member — rule 9 makes transfer drivers staff, not riders — matched by id or email, and it has to be an active account.",
          body: createTransferBody,
          response: transferWithManifestResponse,
          successStatus: 201,
          errors: {
            404: "No such hub, vehicle, route, or driver.",
            422: "Validation failed — including origin and destination being the same hub.",
          },
        },
        update: {
          method: "PATCH",
          path: "/transfers/:id",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.TRANSFERS_MANAGE] },
          summary: "Update a transfer",
          successDescription: "Updated.",
          description:
            "Hubs are editable only while `PLANNED`, because a manifest is validated against the origin hub and changing it afterwards would invalidate every row. Route, vehicle and driver stay editable until the truck departs.",
          params: transferIdParam,
          paramDescriptions: { id: "Transfer id." },
          body: updateTransferBody,
          response: transferWithManifestResponse,
          errors: {
            404: "No such transfer in scope, or a referenced record does not exist.",
            409: "The transfer has departed or finished, so it cannot be edited.",
            422: "Nothing to change.",
          },
        },
        delete: {
          method: "DELETE",
          path: "/transfers/:id",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.TRANSFERS_MANAGE] },
          summary: "Delete a planned transfer",
          successDescription: "Deleted.",
          description:
            "Removes a draft: a `PLANNED` transfer with an empty manifest. Anything further along is cancelled instead, so the record of what was loaded is never destroyed.",
          params: transferIdParam,
          paramDescriptions: { id: "Transfer id." },
          successStatus: 204,
          errors: {
            404: "No such transfer in scope.",
            409: "The transfer is not a draft, or has parcels on it. Cancel it instead.",
          },
        },
        updateStatus: {
          method: "PATCH",
          path: "/transfers/:id/status",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.TRANSFERS_MANAGE] },
          summary: "Update transfer status",
          successDescription: "Updated.",
          description:
            "Moves the transfer along its lifecycle. `IN_TRANSIT` requires a non-empty manifest, stamps `departedAt` and `loadedAt`, and moves every manifest parcel to `IN_TRANSIT`. `ARRIVED` stamps `arrivedAt` and `unloadedAt`, moves every manifest parcel to the destination hub and back to `AT_HUB`. Both write a parcel event per parcel, so the customer's timeline is intact.",
          params: transferIdParam,
          paramDescriptions: { id: "Transfer id." },
          body: updateTransferStatusBody,
          response: transferWithManifestResponse,
          errors: {
            404: "No such transfer in scope.",
            409: "The requested transition is not allowed from the current status.",
            422: "`CANCELLED` requires a reason; `IN_TRANSIT` requires a non-empty manifest.",
          },
        },
        manifestList: {
          method: "GET",
          path: "/transfers/:id/parcels",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.TRANSFERS_VIEW] },
          summary: "List a transfer's manifest",
          successDescription: "The parcels on this transfer.",
          description:
            "The manifest alone, for the sheet that edits a load list without refetching the whole transfer. A bare array, not a page: the manifest is bounded at 500 parcels by `PUT`, so there is nothing to page through — the same shape `routes/:id/stops` returns.",
          params: transferIdParam,
          paramDescriptions: { id: "Transfer id." },
          response: transferParcelList,
          errors: { 404: "No such transfer in scope." },
        },
        manifestReplace: {
          method: "PUT",
          path: "/transfers/:id/parcels",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.TRANSFERS_MANAGE] },
          summary: "Replace a transfer's manifest",
          successDescription: "The new manifest.",
          description:
            "Replaces the whole load list. Every parcel must be at the origin hub and be in a status that may legally depart — a parcel that is not is named in the 422 rather than quietly dropped. Rejected once the transfer is `IN_TRANSIT`, where the manifest is history.",
          params: transferIdParam,
          paramDescriptions: { id: "Transfer id." },
          body: replaceTransferManifestBody,
          response: transferParcelList,
          errors: {
            404: "No such transfer in scope.",
            409: "The transfer has departed, arrived, or been cancelled, so its manifest is fixed.",
            422: "One or more parcels are not at the origin hub, or are already moving.",
          },
        },
      },
    },

    /**
     * Organization: branches and hubs. The first Phase 1 surface, and the two
     * things every other admin screen scopes on.
     *
     * Reads are company-wide by design — a branch manager creating a hub must
     * pick its branch from a list, and that list is the whole company. Narrowing
     * it to the manager's own branch would hide the branches they are allowed to
     * create hubs under. Writes are gated instead: `branches.manage` and
     * `hubs.manage` gate every mutation, `hubs.view` gates reads. The Scope guard
     * that narrows parcel data to a caller's branch/hub does not apply to the
     * organization tables themselves.
     *
     * `hubs` carries its branch's name and code in every row, so a list screen
     * shows "Dhaka Sorting" without a second request per row.
     */
    org: {
      tag: "organization",
      tagDescription:
        "The company's operating structure: branches, then the hubs that hang off them. Reads are company-wide; writes are gated on `branches.manage` and `hubs.manage`.",
      operations: {
        listBranches: {
          method: "GET",
          path: "/branches",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.BRANCHES_VIEW] },
          summary: "List branches",
          successDescription: "A page of branches.",
          query: listBranchesQuery,
          listNodes: branchResponse,
        },
        readBranch: {
          method: "GET",
          path: "/branches/:id",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.BRANCHES_VIEW] },
          summary: "Read a branch",
          successDescription: "The branch.",
          params: branchIdParam,
          paramDescriptions: { id: "Branch id." },
          response: branchResponse,
          errors: { 404: "No such branch." },
        },
        createBranch: {
          method: "POST",
          path: "/branches",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.BRANCHES_MANAGE] },
          summary: "Create a branch",
          successDescription: "Created.",
          body: createBranchBody,
          response: branchResponse,
          successStatus: 201,
          errors: { 409: "A branch with that code already exists." },
        },
        updateBranch: {
          method: "PATCH",
          path: "/branches/:id",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.BRANCHES_MANAGE] },
          summary: "Update a branch",
          successDescription: "Updated.",
          params: branchIdParam,
          paramDescriptions: { id: "Branch id." },
          body: updateBranchBody,
          response: branchResponse,
          errors: { 404: "No such branch.", 409: "A branch with that code already exists." },
        },
        listHubs: {
          method: "GET",
          path: "/hubs",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.HUBS_VIEW] },
          summary: "List hubs",
          successDescription: "A page of hubs, each carrying its branch's name and code.",
          description:
            "Each row carries its branch alongside it, so a list screen does not need a join per row. Filterable by branch, type and status.",
          query: listHubsQuery,
          listNodes: hubResponse,
        },
        readHub: {
          method: "GET",
          path: "/hubs/:id",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.HUBS_VIEW] },
          summary: "Read a hub",
          successDescription: "The hub, with its branch.",
          params: hubIdParam,
          paramDescriptions: { id: "Hub id." },
          response: hubResponse,
          errors: { 404: "No such hub." },
        },
        createHub: {
          method: "POST",
          path: "/hubs",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.HUBS_MANAGE] },
          summary: "Create a hub",
          successDescription: "Created.",
          body: createHubBody,
          response: hubResponse,
          successStatus: 201,
          errors: {
            404: "No such branch — pick an existing branch.",
            409: "A hub with that code already exists.",
          },
        },
        updateHub: {
          method: "PATCH",
          path: "/hubs/:id",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.HUBS_MANAGE] },
          summary: "Update a hub",
          successDescription: "Updated.",
          params: hubIdParam,
          paramDescriptions: { id: "Hub id." },
          body: updateHubBody,
          response: hubResponse,
          errors: { 404: "No such hub.", 409: "A hub with that code already exists." },
        },
      },
    },

    /**
     * Reference reads. The Phase 0 feature, and the reason Phase 0 exists: the
     * parcel-create dialog has six free-text id fields today, and this is what
     * turns them into comboboxes.
     *
     * Three endpoints, not seven, because three is what the gate needs —
     * customers, hubs, zones. Branches, users, riders, and vehicles are not
     * declared until a screen asks for one; adding an entry here is a registry
     * change plus a handler, and the registry is what makes that cheap.
     *
     * Each carries its own `*.view` key rather than one blanket `reference.read`,
     * so a role that may look up a hub to book a parcel is not thereby also
     * granted the customer list.
     */
    reference: {
      tag: "reference",
      tagDescription:
        "Read-only lookups that populate pickers: branches, hubs, zones, and customer search. Narrow projections for comboboxes, not table dumps.",
      operations: {
        listBranches: {
          method: "GET",
          path: "/reference/branches",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.BRANCHES_VIEW] },
          summary: "List branches (picker)",
          successDescription: "A page of branches.",
          description:
            "Branch lookup for the hub-create picker. Narrow projection — name and code only, no city, coordinates or phone.",
          query: listBranchesQuerySchema,
          listNodes: branchRefResponseSchema,
        },
        listHubs: {
          method: "GET",
          path: "/reference/hubs",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.HUBS_VIEW] },
          summary: "List hubs (picker)",
          successDescription: "A page of hubs.",
          description:
            "Branch-scoped hub lookup for pickers. A non-company-wide caller sees only their own branch's hubs, narrowed further to their assigned hubs where the role says so. Only the fields a combobox renders are returned — no coordinates, no capacity.",
          query: listHubsQuerySchema,
          listNodes: hubRefResponseSchema,
        },
        listZones: {
          method: "GET",
          path: "/reference/zones",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.ZONES_VIEW] },
          summary: "List zones (picker)",
          successDescription: "A page of zones.",
          description:
            "Delivery zones for pickers. Zones are company-wide rather than branch-scoped, so this is not filtered by the caller's branch.",
          query: listZonesQuerySchema,
          listNodes: zoneRefResponseSchema,
        },
        searchCustomers: {
          method: "GET",
          path: "/reference/customers",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.CUSTOMERS_VIEW] },
          summary: "Search customers (picker)",
          successDescription: "A page of customers.",
          description:
            "Customer search for pickers, matching on name, phone, or email. The projection deliberately excludes addresses and consent timestamps: a combobox has no use for them, and a published contract that omits them cannot be quietly widened later.",
          query: searchCustomersQuerySchema,
          listNodes: customerRefResponseSchema,
        },
      },
    },

    bootstrap: {
      tag: "bootstrap",
      tagDescription:
        "First-run setup. One unauthenticated route that creates the initial administrator, closed by a shared token and by itself once an admin exists.",
      operations: {
        create: {
          method: "POST",
          path: "/bootstrap",
          // Public by necessity: this is the only way to create the first account, so
          // there is no admin to authenticate as yet. Safety lives in the handler —
          // a constant-time `BOOTSTRAP_TOKEN` comparison plus a one-shot refusal once
          // any account holds the ADMIN role — and not in this flag.
          policy: { public: true },
          summary: "Create the first administrator",
          successDescription: "The administrator that was created.",
          description:
            "One-shot. Requires the server's `BOOTSTRAP_TOKEN` in the body, and refuses once any account already holds the ADMIN role — so after first use this route is permanently closed and every later staff account is created from the authenticated admin app. The one-shot test runs under a row lock, so concurrent calls cannot both win. Roles must already be seeded (`bun run db:seed`), since the role grant is what makes the account an administrator.",
          body: bootstrapAdminSchema,
          response: bootstrapAdminResponseSchema,
          errors: {
            401: "The token does not match `BOOTSTRAP_TOKEN`.",
            403: "`BOOTSTRAP_TOKEN` is not configured, so bootstrap is disabled.",
            409: "An administrator already exists, no roles are seeded, or the email is taken.",
          },
        },
      },
    },

    zones: {
      tag: "zones",
      tagDescription:
        "Geographic pricing zones and the pricing rules that hang off them. Zones are company-wide reference data.",
      operations: {
        list: {
          method: "GET",
          path: "/zones",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.ZONES_VIEW] },
          summary: "List zones",
          successDescription: "A page of zones.",
          query: listZonesQuery,
          listNodes: zoneResponse,
        },
        read: {
          method: "GET",
          path: "/zones/:id",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.ZONES_VIEW] },
          summary: "Read a zone",
          successDescription: "The zone.",
          params: zoneIdParam,
          paramDescriptions: { id: "Zone id." },
          response: zoneResponse,
          errors: { 404: "No such zone." },
        },
        create: {
          method: "POST",
          path: "/zones",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.ZONES_MANAGE] },
          summary: "Create a zone",
          successDescription: "Created.",
          body: createZoneBody,
          response: zoneResponse,
          successStatus: 201,
          errors: { 409: "A zone with that code already exists." },
        },
        update: {
          method: "PATCH",
          path: "/zones/:id",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.ZONES_MANAGE] },
          summary: "Update a zone",
          successDescription: "Updated.",
          params: zoneIdParam,
          paramDescriptions: { id: "Zone id." },
          body: updateZoneBody,
          response: zoneResponse,
          errors: { 404: "No such zone.", 409: "A zone with that code already exists." },
        },
      },
    },

    vehicles: {
      tag: "vehicles",
      tagDescription:
        "Fleet vehicles used on transfers. Read-only for most roles; writes are gated on `vehicles.manage`.",
      operations: {
        list: {
          method: "GET",
          path: "/vehicles",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.VEHICLES_VIEW] },
          summary: "List vehicles",
          successDescription: "A page of vehicles.",
          query: listVehiclesQuery,
          listNodes: vehicleResponse,
        },
        read: {
          method: "GET",
          path: "/vehicles/:id",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.VEHICLES_VIEW] },
          summary: "Read a vehicle",
          successDescription: "The vehicle.",
          params: vehicleIdParam,
          paramDescriptions: { id: "Vehicle id." },
          response: vehicleResponse,
          errors: { 404: "No such vehicle." },
        },
        create: {
          method: "POST",
          path: "/vehicles",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.VEHICLES_MANAGE] },
          summary: "Create a vehicle",
          successDescription: "Created.",
          body: createVehicleBody,
          response: vehicleResponse,
          successStatus: 201,
          errors: { 409: "A vehicle with that registration number already exists." },
        },
        update: {
          method: "PATCH",
          path: "/vehicles/:id",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.VEHICLES_MANAGE] },
          summary: "Update a vehicle",
          successDescription: "Updated.",
          params: vehicleIdParam,
          paramDescriptions: { id: "Vehicle id." },
          body: updateVehicleBody,
          response: vehicleResponse,
          errors: {
            404: "No such vehicle.",
            409: "A vehicle with that registration number already exists.",
          },
        },
        deactivate: {
          method: "POST",
          path: "/vehicles/:id/deactivate",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.VEHICLES_MANAGE] },
          summary: "Deactivate a vehicle",
          successDescription: "Deactivated.",
          description:
            "Retires a vehicle from the fleet by moving it to `INACTIVE`, so it can no longer be assigned to a transfer. A vehicle that is already inactive is rejected rather than silently accepted, so a double-click surfaces instead of passing for a state change.",
          params: vehicleIdParam,
          paramDescriptions: { id: "Vehicle id." },
          response: vehicleResponse,
          errors: {
            404: "No such vehicle.",
            409: "The vehicle is already inactive.",
          },
        },
      },
    },

    riders: {
      tag: "riders",
      tagDescription:
        "Delivery riders. Each rider is a `users` account plus a `riders` row, so creating one also creates the login the rider app signs in with.",
      operations: {
        list: {
          method: "GET",
          path: "/riders",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.RIDERS_VIEW] },
          summary: "List riders",
          successDescription: "A page of riders.",
          query: listRidersQuery,
          listNodes: riderResponse,
        },
        read: {
          method: "GET",
          path: "/riders/:id",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.RIDERS_VIEW] },
          summary: "Read a rider",
          successDescription: "The rider.",
          params: riderIdParam,
          paramDescriptions: { id: "Rider id." },
          response: riderResponse,
          errors: { 404: "No such rider." },
        },
        create: {
          method: "POST",
          path: "/riders",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.RIDERS_MANAGE] },
          summary: "Create a rider",
          description:
            "Creates the rider's login account and their `riders` row in one transaction, because a rider is always both (rule 8) and neither half is useful alone.",
          successDescription: "Created.",
          body: createRiderBody,
          response: riderResponse,
          successStatus: 201,
          errors: {
            409: "That email is already registered, or the employee code is already in use.",
          },
        },
        update: {
          method: "PATCH",
          path: "/riders/:id",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.RIDERS_MANAGE] },
          summary: "Update a rider",
          successDescription: "Updated.",
          description:
            "Hub, employee code, licence, compensation and status only. The rider's email, name and password belong to their `users` account and are not editable here.",
          params: riderIdParam,
          paramDescriptions: { id: "Rider id." },
          body: updateRiderBody,
          response: riderResponse,
          errors: {
            404: "No such rider.",
            409: "That employee code is already in use.",
          },
        },
        setStatus: {
          method: "POST",
          path: "/riders/:id/status",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.RIDERS_MANAGE] },
          summary: "Set a rider's availability",
          description:
            "Availability is its own operation because ops flips it constantly from the dispatch board, and because it has distinct transition rules from the rest of the rider record.",
          successDescription: "Updated.",
          params: riderIdParam,
          paramDescriptions: { id: "Rider id." },
          body: setRiderStatusBody,
          response: riderResponse,
          errors: { 404: "No such rider." },
        },
      },
    },
    riderLocations: {
      tag: "rider-locations",
      tagDescription:
        "Where riders are. Fixes are append-only, written only by the rider app's `POST /jobs/locations`, and read here.",
      operations: {
        list: {
          method: "GET",
          path: "/rider-locations",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.RIDERS_VIEW] },
          summary: "List rider location history",
          description:
            "Every rider's fixes, newest first. Pass `riderId` for one rider's trail. There is no write operation here on purpose: a position is the rider's own to report, so the admin surface is read-only over data the rider app pushed.",
          successDescription: "A page of recorded locations.",
          query: listRiderLocationsQuery,
          listNodes: riderLocationResponse,
        },
      },
    },
    riderApplications: {
      tag: "rider applications",
      tagDescription:
        "Public applications from people interested in joining the DropX rider network.",
      operations: {
        list: {
          method: "GET",
          path: "/rider-applications",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.RIDERS_VIEW] },
          summary: "List rider applications",
          successDescription: "A page of rider applications.",
          query: listRiderApplicationsQuerySchema,
          listNodes: riderApplicationResponseSchema,
        },
        updateStatus: {
          method: "PATCH",
          path: "/rider-applications/:id/status",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.RIDERS_MANAGE] },
          summary: "Update rider application status",
          successDescription: "Application status updated.",
          params: riderApplicationIdParamSchema,
          body: updateRiderApplicationSchema,
          response: riderApplicationResponseSchema,
          errors: { 404: "No such rider application." },
        },
        approve: {
          method: "POST",
          path: "/rider-applications/:id/approve",
          policy: { audience: ["admin"], permissions: [PERMISSIONS.RIDERS_MANAGE] },
          summary: "Approve a rider application",
          description:
            "Creates the rider login and operational rider record, then marks the application approved in one transaction.",
          params: riderApplicationIdParamSchema,
          body: approveRiderApplicationSchema,
          response: approveRiderApplicationResponseSchema,
          errors: {
            404: "No such rider application.",
            409: "The application is already approved, or the email/employee code is already in use.",
          },
        },
      },
    },
  },
})
