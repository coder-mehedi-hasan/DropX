import { bearerSecurity, errorResponse } from "../components"
import { jsonSchemaOf, pageSchema } from "../schema"
import {
  listParcelsQuerySchema,
  parcelResponseSchema,
  parcelWithItemsResponseSchema,
  createOwnParcelSchema,
} from "../../modules/parcels/parcels.dto"

/**
 * `parcels` operations — the **customer** surface only.
 *
 * The five staff operations moved to the admin surface, where the registry
 * generates this fragment. What remains is described here by hand because these
 * operations are not in a registry yet; `coverage.ts` is the check that keeps
 * this file honest against the policy catalog.
 */

const json = (schema: ReturnType<typeof jsonSchemaOf>) => ({
  content: { "application/json": { schema } },
})

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
const notActive = errorResponse("The customer session is not ACTIVE (OTP not verified).")
const notFound = errorResponse("No such parcel in scope.")

const parcelPage = json(pageSchema(jsonSchemaOf(parcelResponseSchema, "output")))
const parcelBody = json(jsonSchemaOf(parcelWithItemsResponseSchema, "output"))

const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
  description: "Parcel id.",
} as const

export const parcelsPaths = {
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
        422: errorResponse("Validation failed, or no pricing rule covers the route/weight."),
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
} as const

export const parcelsTags = [
  { name: "parcels", description: "Customer parcel booking and the customer's own parcel views." },
]
