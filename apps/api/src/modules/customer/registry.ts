import { defineSurface } from "../../shared/auth/surface"
import {
  listParcelsQuerySchema,
  parcelIdParamSchema,
  parcelResponseSchema,
  parcelWithItemsResponseSchema,
  createParcelSchema,
} from "../parcels/parcels.dto"

/**
 * Customer self-service create.
 *
 * The sender is the session and the fee is quoted by the service, so
 * `senderCustomerId` is not merely ignored here — it is not part of the input at
 * all, which is why this is a separate schema rather than the staff one with a
 * runtime check. A customer cannot book on someone else's behalf because the
 * shape of the request has nowhere to put the other party's id.
 */
export const createOwnParcelSchema = createParcelSchema.omit({ senderCustomerId: true })

/**
 * The customer surface — the portal's whole contract.
 *
 * The same shape as the admin surface, and the reason both exist: `/admin` and
 * `/customer` are separate mounts with separate `audience` values, so a customer
 * token cannot reach a staff operation no matter what the client sends. The old
 * arrangement — one router, `/parcels` for staff and `/parcels/mine*` for
 * customers — made that a property of the path string rather than of the policy.
 *
 * The `mine` prefix is gone because the mount now says what it was repeating.
 * These three ids are `customer.parcels.*`, plural for the same reason the
 * admin's are: the id is namespace + feature key + operation key.
 */
export const CUSTOMER_SURFACE = defineSurface({
  namespace: "customer",
  basePath: "/customer",
  // Declared once for the surface because it is true of every customer
  // operation, and because the built-in default is *wrong* here: customers hold
  // no permission keys, so a 403 can only mean the session is not ACTIVE yet.
  errors: {
    403: "The customer session is not ACTIVE (OTP not verified).",
  },
  features: {
    parcels: {
      tag: "parcels",
      operations: {
        list: {
          method: "GET",
          path: "/parcels",
          policy: { audience: ["web"], requiresActiveCustomer: true },
          summary: "List my parcels (customer)",
          successDescription: "A page of parcels.",
          description:
            "Parcels where the signed-in customer is the sender or the receiver — never the whole collection.",
          query: listParcelsQuerySchema,
          listNodes: parcelResponseSchema,
        },
        read: {
          method: "GET",
          path: "/parcels/:id",
          policy: { audience: ["web"], requiresActiveCustomer: true },
          summary: "Read one of my parcels (customer)",
          successDescription: "The parcel.",
          description: "Full parcel with items, limited to parcels the customer is party to.",
          params: parcelIdParamSchema,
          paramDescriptions: { id: "Parcel id." },
          response: parcelWithItemsResponseSchema,
          errors: { 404: "No such parcel in scope." },
        },
        create: {
          method: "POST",
          path: "/parcels",
          policy: { audience: ["web"], requiresActiveCustomer: true },
          summary: "Book a parcel (customer)",
          successDescription: "Created.",
          description:
            "Self-service booking. The sender is the session — `senderCustomerId` is not accepted on this input at all, and the delivery fee is quoted server-side.",
          body: createOwnParcelSchema,
          response: parcelWithItemsResponseSchema,
          successStatus: 201,
          errors: {
            422: "Validation failed, or no pricing rule covers the route/weight.",
          },
        },
      },
    },
  },
})
