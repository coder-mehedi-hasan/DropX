import { PERMISSIONS } from "../../shared/auth/permissions"
import { defineSurface } from "../../shared/auth/surface"
import {
  customerRefResponseSchema,
  hubRefResponseSchema,
  listHubsQuerySchema,
  listZonesQuerySchema,
  searchCustomersQuerySchema,
  zoneRefResponseSchema,
} from "../reference/reference.dto"
import {
  cancelParcelSchema,
  createParcelSchema,
  listParcelsQuerySchema,
  parcelIdParamSchema,
  parcelResponseSchema,
  parcelWithItemsResponseSchema,
  updateParcelStatusSchema,
} from "../parcels/parcels.dto"

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
        "Read-only lookups that populate pickers: hubs, zones, and customer search. Narrow projections for comboboxes, not table dumps.",
      operations: {
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
  },
})
