import { bearerSecurity, errorResponse } from "../components"
import { jsonSchemaOf } from "../schema"
import { quoteResponseSchema, quoteSchema } from "../../modules/pricing/pricing.dto"

/**
 * `pricing` — delivery-fee quoting.
 *
 * A read (`GET` with query params), available to the admin and the customer
 * portal so a fee can be shown before committing. The rule is anchored on the
 * **lane matrix**: the two cities' service types pick the row and the weight
 * picks the slab. The fee is always recomputed server-side at booking and
 * anything the client sends here is ignored.
 */

const json = (schema: ReturnType<typeof jsonSchemaOf>) => ({
  content: { "application/json": { schema } },
})

const quoteParams = () => {
  const schema = jsonSchemaOf(quoteSchema, "input")
  return Object.entries(schema.properties as Record<string, any>).map(([name, propertySchema]) => ({
    name,
    in: "query",
    required: Boolean((schema.required as string[] | undefined)?.includes(name)),
    schema: propertySchema,
  }))
}

export const pricingPaths = {
  "/pricing/quote": {
    get: {
      operationId: "pricing.quote",
      summary: "Quote a delivery fee",
      description:
        "Picks the active lane whose pickup type, delivery type and same-city flag match the two cities, then the slab whose weight band covers the parcel. Returns base + COD + extra-weight fees. The booking endpoints re-compute this and never trust a client-sent fee.",
      tags: ["pricing"],
      security: bearerSecurity,
      parameters: quoteParams(),
      responses: {
        200: {
          description: "The computed quote.",
          ...json(jsonSchemaOf(quoteResponseSchema, "output")),
        },
        401: errorResponse("Not authenticated."),
        422: errorResponse("No active lane covers that route, or no slab covers that weight."),
      },
    },
  },
} as const

export const pricingTags = [{ name: "pricing", description: "Server-side delivery-fee quoting." }]
