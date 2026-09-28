import { bearerSecurity, errorResponse } from "../components"
import { jsonSchemaOf, pageSchema } from "../schema"
import {
  listParcelsQuerySchema,
  parcelResponseSchema,
  parcelWithItemsResponseSchema,
  createOwnParcelSchema,
  createParcelSchema,
  updateParcelStatusSchema,
  cancelParcelSchema,
} from "../../modules/parcels/parcels.dto"

/**
 * `parcels` operations — the console and customer parcel surface.
 *
 * The console list and the customer list share one response envelope but accept
 * different filter inputs, so they are described separately even where the 200
 * body is identical.
 */

const json = (schema: ReturnType<typeof jsonSchemaOf>) => ({
  content: { "application/json": { schema } },
})

const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
  description: "Parcel id.",
} as const

/** The shared list query, described from the DTO so params cannot drift. */
const listQueryParams = () => {
  const schema = jsonSchemaOf(listParcelsQuerySchema, "input")
  return Object.entries(schema.properties as Record<string, any>).map(([name, propertySchema]) => ({
    name,
    in: "query",
    required: Boolean((schema.required as string[] | undefined)?.includes(name)),
    schema: propertySchema,
  }))
}

const unauth = errorResponse("Not authenticated, or the token is missing/expired.")
const forbidden = errorResponse(
  "Missing a required permission, or outside the caller's branch/hub scope.",
)
const notFound = errorResponse("No such parcel in scope.")
const notActive = errorResponse("The customer session is not ACTIVE (OTP not verified).")
const validation = errorResponse("Validation failed, or no pricing rule covers the route/weight.")

const parcelPage = json(pageSchema(jsonSchemaOf(parcelResponseSchema, "output")))
const parcelBody = json(jsonSchemaOf(parcelWithItemsResponseSchema, "output"))
const parcel = json(jsonSchemaOf(parcelResponseSchema, "output"))

export const parcelsPaths = {
  "/parcels": {
    get: {
      operationId: "parcel.list",
      summary: "List parcels (console)",
      description:
        "Branch/hub-scoped list for staff. Ordering is limited to an allowlist of columns; an unknown `sortBy` is rejected rather than interpolated into SQL.",
      tags: ["parcels"],
      security: bearerSecurity,
      parameters: listQueryParams(),
      responses: {
        200: { description: "A page of parcels.", ...parcelPage },
        401: unauth,
        403: forbidden,
      },
    },
    post: {
      operationId: "parcel.create",
      summary: "Create a parcel (staff)",
      description:
        "Books a parcel on a customer's behalf, so `senderCustomerId` is required. The delivery fee is quoted server-side from the destination zone and is never accepted from the client.",
      tags: ["parcels"],
      security: bearerSecurity,
      requestBody: { required: true, ...json(jsonSchemaOf(createParcelSchema, "input")) },
      responses: {
        201: { description: "Created.", ...parcelBody },
        401: unauth,
        403: forbidden,
        422: validation,
      },
    },
  },
  "/parcels/mine": {
    post: {
      operationId: "parcel.createOwn",
      summary: "Book a parcel (customer)",
      description:
        "Customer self-service booking. The sender is the session — `senderCustomerId` is not accepted on this input at all.",
      tags: ["parcels"],
      security: bearerSecurity,
      requestBody: { required: true, ...json(jsonSchemaOf(createOwnParcelSchema, "input")) },
      responses: {
        201: { description: "Created.", ...parcelBody },
        401: unauth,
        403: notActive,
        422: validation,
      },
    },
  },
  "/parcels/mine/list": {
    get: {
      operationId: "parcel.listOwn",
      summary: "List my parcels (customer)",
      description:
        "The customer portal's list — parcels where the signed-in customer is the sender or the receiver.",
      tags: ["parcels"],
      security: bearerSecurity,
      parameters: listQueryParams(),
      responses: {
        200: { description: "A page of parcels.", ...parcelPage },
        401: unauth,
        403: notActive,
      },
    },
  },
  "/parcels/mine/{id}": {
    get: {
      operationId: "parcel.readOwn",
      summary: "Read one of my parcels (customer)",
      description: "Full parcel with items, limited to parcels the customer is party to.",
      tags: ["parcels"],
      security: bearerSecurity,
      parameters: [idParam],
      responses: {
        200: { description: "The parcel.", ...parcelBody },
        401: unauth,
        403: notActive,
        404: notFound,
      },
    },
  },
  "/parcels/{id}": {
    get: {
      operationId: "parcel.read",
      summary: "Read a parcel (console)",
      description: "Full parcel with its items, scoped to the caller's branch/hubs.",
      tags: ["parcels"],
      security: bearerSecurity,
      parameters: [idParam],
      responses: {
        200: { description: "The parcel.", ...parcelBody },
        401: unauth,
        403: forbidden,
        404: notFound,
      },
    },
  },
  "/parcels/{id}/status": {
    patch: {
      operationId: "parcel.updateStatus",
      summary: "Update parcel status (console)",
      description:
        "Advances the parcel lifecycle. A transition that is not legal from the current status is rejected with `INVALID_STATE_TRANSITION`.",
      tags: ["parcels"],
      security: bearerSecurity,
      parameters: [idParam],
      requestBody: { required: true, ...json(jsonSchemaOf(updateParcelStatusSchema, "input")) },
      responses: {
        200: { description: "Updated.", ...parcel },
        401: unauth,
        403: forbidden,
        404: notFound,
        409: errorResponse(
          "The requested status transition is not allowed from the current status.",
        ),
      },
    },
  },
  "/parcels/{id}/cancel": {
    post: {
      operationId: "parcel.cancel",
      summary: "Cancel a parcel (console)",
      description: "Cancels a parcel that has not been delivered yet. A reason is required.",
      tags: ["parcels"],
      security: bearerSecurity,
      parameters: [idParam],
      requestBody: { required: true, ...json(jsonSchemaOf(cancelParcelSchema, "input")) },
      responses: {
        200: { description: "Cancelled.", ...parcel },
        401: unauth,
        403: forbidden,
        404: notFound,
        409: errorResponse("The parcel cannot be cancelled from its current status."),
      },
    },
  },
} as const

export const parcelsTags = [
  { name: "parcels", description: "Parcel booking plus the console and customer parcel views." },
]
