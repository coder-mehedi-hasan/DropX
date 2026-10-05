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
  createRiderSchema as createRiderBody,
  listRidersQuerySchema as listRidersQuery,
  riderIdParamSchema as riderIdParam,
  riderResponseSchema as riderResponse,
  setRiderStatusSchema as setRiderStatusBody,
  updateRiderSchema as updateRiderBody,
} from "../riders/riders.dto"
import { bootstrapAdminResponseSchema, bootstrapAdminSchema } from "./bootstrap.dto"

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
  },
})
