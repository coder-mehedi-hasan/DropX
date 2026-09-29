import { PERMISSIONS } from "../../shared/auth/permissions"
import { defineSurface } from "../../shared/auth/surface"
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
  },
})
