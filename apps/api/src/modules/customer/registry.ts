import { defineSurface } from "../../shared/auth/surface"
import {
  customerRefResponseSchema,
  hubRefResponseSchema,
  listHubsQuerySchema,
  searchCustomersQuerySchema,
} from "../reference/reference.dto"
import {
  areaRefResponseSchema,
  cityRefResponseSchema,
  cityZonesParamSchema,
  listCitiesQuerySchema,
  listCityZonesQuerySchema,
  listZoneAreasQuerySchema,
  zoneAreasParamSchema,
  zoneRefResponseSchema as serviceZoneRefResponseSchema,
} from "../locations/locations.dto"
import {
  listParcelsQuerySchema,
  parcelIdParamSchema,
  parcelResponseSchema,
  parcelDetailResponseSchema,
  createParcelSchema,
  saveParcelDraftSchema,
  parcelDraftResponseSchema,
} from "../parcels/parcels.dto"
import {
  createCustomerAddressSchema,
  customerAddressIdParamSchema,
  customerAddressResponseSchema,
  updateCustomerAddressSchema,
} from "../customer-addresses/customer-addresses.dto"
import {
  customerProfileResponseSchema,
  updateCustomerProfileSchema,
} from "../customer-profile/customer-profile.dto"
import { pricingLaneWithSlabsResponseSchema } from "../pricing/pricing-lanes.dto"

/**
 * Customer self-service create.
 *
 * The sender is the session and the fee is quoted by the service, so
 * `senderCustomerId` is not merely ignored here — it is not part of the input at
 * all, which is why this is a separate schema rather than the staff one with a
 * runtime check. A customer cannot book on someone else's behalf because the
 * shape of the request has nowhere to put the other party's id.
 *
 * Hubs go the same way: a portal booking is addressed, not routed. The service
 * resolves origin and destination from the active hubs and the addresses' map
 * coordinates (`resolveHubPair`), so neither id appears on this wire at all —
 * and one sent anyway is stripped by the schema rather than honoured.
 */
export const createOwnParcelSchema = createParcelSchema.omit({
  senderCustomerId: true,
  originHubId: true,
  destinationHubId: true,
})

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
    reference: {
      tag: "customer-reference",
      tagDescription: "Bookable hubs and recipient customers.",
      operations: {
        listHubs: {
          method: "GET",
          path: "/reference/hubs",
          policy: { audience: ["web"], requiresActiveCustomer: true },
          summary: "List bookable hubs",
          successDescription: "A page of active hubs.",
          query: listHubsQuerySchema,
          listNodes: hubRefResponseSchema,
        },
        searchRecipients: {
          method: "GET",
          path: "/reference/recipients",
          policy: { audience: ["web"], requiresActiveCustomer: true },
          summary: "Search recipient customers",
          successDescription: "A page of active recipient customers.",
          query: searchCustomersQuerySchema,
          listNodes: customerRefResponseSchema,
        },
      },
    },
    /**
     * The booking cascade: cities, then the zones of one city, then the areas
     * of one zone. The three ids a client needs for the next hop come back in
     * the rows it already received, so the path segments are never guessed.
     *
     * Only `ACTIVE` rows are served — a retired location must disappear from
     * the picker without disappearing from the parcels that were sent there.
     */
    locations: {
      tag: "customer-locations",
      tagDescription:
        "The cascading location picker behind booking: cities, then one city's zones, then one zone's areas. Active rows only.",
      operations: {
        listCities: {
          method: "GET",
          path: "/locations/cities",
          policy: { audience: ["web"], requiresActiveCustomer: true },
          summary: "List bookable cities",
          successDescription: "A page of active cities.",
          query: listCitiesQuerySchema,
          listNodes: cityRefResponseSchema,
        },
        listZones: {
          method: "GET",
          path: "/locations/cities/:cityId/zones",
          policy: { audience: ["web"], requiresActiveCustomer: true },
          summary: "List a city's zones",
          successDescription: "A page of the city's active zones.",
          description:
            "The second hop of the cascade. A zone whose `cityId` is not the one in the path is never returned.",
          params: cityZonesParamSchema,
          paramDescriptions: { cityId: "The city these zones belong to." },
          query: listCityZonesQuerySchema,
          listNodes: serviceZoneRefResponseSchema,
          errors: { 404: "No such city." },
        },
        listAreas: {
          method: "GET",
          path: "/locations/zones/:zoneId/areas",
          policy: { audience: ["web"], requiresActiveCustomer: true },
          summary: "List a zone's areas",
          successDescription: "A page of the zone's active areas.",
          description:
            "The third hop of the cascade. Areas are optional — a booking may stop at the zone and type an address line.",
          params: zoneAreasParamSchema,
          paramDescriptions: { zoneId: "The zone these areas belong to." },
          query: listZoneAreasQuerySchema,
          listNodes: areaRefResponseSchema,
          errors: { 404: "No such zone." },
        },
      },
    },

    /**
     * The published price list, so a customer can see what a lane costs before
     * booking. Same matrix the quote and the parcel fee are computed from —
     * read-only, `ACTIVE` rows only, served with the admin lanes shape under
     * the shared `pricing-lanes` tag.
     */
    pricing: {
      tag: "pricing-lanes",
      operations: {
        listPlans: {
          method: "GET",
          path: "/pricing/lanes",
          policy: { audience: ["web"], requiresActiveCustomer: true },
          summary: "List pricing plans",
          successDescription: "Every active pricing lane with its weight slabs.",
          description:
            "The whole published matrix — lane pairs with their slabs in weight order. Retired lanes are never returned, and there is nothing to page: the price list is one document.",
          listNodes: pricingLaneWithSlabsResponseSchema,
        },
      },
    },

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
          description:
            "The parcel with its items and both structured addresses, limited to parcels the customer is party to.",
          params: parcelIdParamSchema,
          paramDescriptions: { id: "Parcel id." },
          response: parcelDetailResponseSchema,
          errors: { 404: "No such parcel in scope." },
        },
        create: {
          method: "POST",
          path: "/parcels",
          policy: { audience: ["web"], requiresActiveCustomer: true },
          summary: "Book a parcel (customer)",
          successDescription: "Created.",
          description:
            "Self-service booking. The sender is the session and neither hub id is accepted — `senderCustomerId` is stamped from the session, and origin/destination hubs are resolved server-side from the address coordinates. The delivery fee is quoted from the lane matrix.",
          body: createOwnParcelSchema,
          response: parcelDetailResponseSchema,
          successStatus: 201,
          errors: {
            422: "Validation failed, or the price list covers neither the route nor the weight.",
          },
        },
      },
    },

    /**
     * The in-progress booking, autosaved while the form is filled.
     *
     * One draft per customer, keyed by the session's own id — the write is an
     * upsert, so the client never holds a draft id and a dropped autosave
     * simply means the next one replaces the same row. The payload is the
     * booking form's raw values (strings, half-filled), deliberately looser
     * than `createOwnParcelSchema`: a draft must be savable *before* it is
     * valid, and only the real booking validates it end to end.
     *
     * The path is `/parcel-drafts`, not `/parcels/draft`, so these routes can
     * never be shadowed by (or shadow) `GET /parcels/:id`.
     */
    parcelDrafts: {
      tag: "parcel-drafts",
      tagDescription:
        "The signed-in customer's single in-progress booking, autosaved while the booking form is being filled.",
      operations: {
        save: {
          method: "POST",
          path: "/parcel-drafts",
          policy: { audience: ["web"], requiresActiveCustomer: true },
          summary: "Save my booking draft",
          successDescription: "The stored draft.",
          description:
            "Create or replace the session's draft booking. Called by the booking form on a debounce as fields change; the customer id is the session, never the body.",
          body: saveParcelDraftSchema,
          response: parcelDraftResponseSchema,
          errors: { 422: "Validation failed — the draft payload is malformed." },
        },
        read: {
          method: "GET",
          path: "/parcel-drafts",
          policy: { audience: ["web"], requiresActiveCustomer: true },
          summary: "Read my booking draft",
          successDescription: "The stored draft.",
          description:
            "The session's draft, so the booking form can restore where the customer left off. 404 means there is nothing to restore.",
          response: parcelDraftResponseSchema,
          errors: { 404: "No saved draft." },
        },
        discard: {
          method: "DELETE",
          path: "/parcel-drafts",
          policy: { audience: ["web"], requiresActiveCustomer: true },
          summary: "Discard my booking draft",
          successDescription: "Deleted.",
          description:
            "Deletes the session's draft. Idempotent — called after a successful booking and safe to call when nothing was saved.",
          successStatus: 204,
        },
      },
    },

    /**
     * The customer's saved-address book.
     *
     * Structured like one end of a booking so a saved address can prefill the
     * booking cascade without a translation layer. Every operation is scoped to
     * the session's own customer id, and the location cascade is re-validated
     * server-side on write — a saved address that cannot prefill a booking is a
     * dead row.
     */
    addresses: {
      tag: "customer-addresses",
      tagDescription:
        "The signed-in customer's saved addresses, structured to prefill the booking cascade.",
      operations: {
        list: {
          method: "GET",
          path: "/addresses",
          policy: { audience: ["web"], requiresActiveCustomer: true },
          summary: "List my saved addresses",
          successDescription: "The saved addresses.",
          response: customerAddressResponseSchema,
        },
        create: {
          method: "POST",
          path: "/addresses",
          policy: { audience: ["web"], requiresActiveCustomer: true },
          summary: "Save an address",
          successDescription: "Saved.",
          description:
            "Stores a structured address — the same city/zone/area cascade a booking end uses — so it can prefill the booking form.",
          body: createCustomerAddressSchema,
          response: customerAddressResponseSchema,
          successStatus: 201,
          errors: {
            422: "Validation failed, or the zone does not belong to the city.",
          },
        },
        update: {
          method: "PATCH",
          path: "/addresses/:id",
          policy: { audience: ["web"], requiresActiveCustomer: true },
          summary: "Edit a saved address",
          successDescription: "Updated.",
          params: customerAddressIdParamSchema,
          paramDescriptions: { id: "Saved address id." },
          body: updateCustomerAddressSchema,
          response: customerAddressResponseSchema,
          errors: {
            404: "No such saved address.",
            422: "Validation failed, or the zone does not belong to the city.",
          },
        },
        delete: {
          method: "DELETE",
          path: "/addresses/:id",
          policy: { audience: ["web"], requiresActiveCustomer: true },
          summary: "Delete a saved address",
          successDescription: "Deleted.",
          params: customerAddressIdParamSchema,
          paramDescriptions: { id: "Saved address id." },
          successStatus: 204,
          errors: { 404: "No such saved address." },
        },
      },
    },

    /**
     * The customer's own profile.
     *
     * The two editable fields a customer owns — the display name shown in the
     * portal and across their parcels, and the avatar whose bytes live in
     * object storage. Phone and email are the OTP identifiers and are
     * deliberately absent from the write schema.
     */
    profile: {
      tag: "customer-profile",
      tagDescription: "The signed-in customer's own profile: display name and avatar.",
      operations: {
        read: {
          method: "GET",
          path: "/profile",
          policy: { audience: ["web"], requiresActiveCustomer: true },
          summary: "Read my profile",
          successDescription: "The profile.",
          description: "The signed-in customer's own profile, scoped to the session.",
          response: customerProfileResponseSchema,
        },
        update: {
          method: "PATCH",
          path: "/profile",
          policy: { audience: ["web"], requiresActiveCustomer: true },
          summary: "Update my profile",
          successDescription: "Updated.",
          description:
            "Edits the display name and/or the avatar URL (null or empty string removes the picture). Phone and email are not editable here.",
          body: updateCustomerProfileSchema,
          response: customerProfileResponseSchema,
          errors: { 404: "No such customer." },
        },
      },
    },
  },
})
