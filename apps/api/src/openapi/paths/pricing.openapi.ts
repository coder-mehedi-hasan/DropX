import { z } from "zod"

import { bearerSecurity, errorResponse } from "../components"
import { jsonSchemaOf, pageSchema, propertySchemaOf } from "../schema"
import { quoteResponseSchema, quoteSchema } from "../../modules/pricing/pricing.dto"
import {
  createPricingRuleSchema,
  listPricingRulesQuerySchema,
  matchPricingRulesQuerySchema,
  pricingRuleIdParamSchema,
  pricingRuleResponseSchema,
  updatePricingRuleSchema,
} from "../../modules/pricing/pricing-rules.dto"

/**
 * `pricing` — delivery-fee quoting.
 *
 * A read (`GET` with query params), available to the admin and the customer
 * portal so a fee can be shown before committing. The rule is anchored on the
 * **destination zone**; the fee is always recomputed server-side at booking and
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

const queryParamsOf = (schema: z.ZodType) => {
  const jsonSchema = jsonSchemaOf(schema, "input")
  return Object.entries(jsonSchema.properties as Record<string, any>).map(
    ([name, propertySchema]) => ({
      name,
      in: "query",
      required: Boolean((jsonSchema.required as string[] | undefined)?.includes(name)),
      schema: propertySchema,
    }),
  )
}

const rulesListParams = () => queryParamsOf(listPricingRulesQuerySchema)
const rulesMatchParams = () => queryParamsOf(matchPricingRulesQuerySchema)

const rulesIdParam = () => ({
  name: "id",
  in: "path",
  required: true,
  schema: propertySchemaOf(pricingRuleIdParamSchema, "id"),
  description: "Pricing rule id.",
})

export const pricingPaths = {
  "/pricing/quote": {
    get: {
      operationId: "pricing.quote",
      summary: "Quote a delivery fee",
      description:
        "Picks the active pricing rule whose origin zone, destination zone and weight band all match, then computes base + per-kg, plus any COD and express adders. The booking endpoints re-compute this and never trust a client-sent fee.",
      tags: ["pricing"],
      security: bearerSecurity,
      parameters: quoteParams(),
      responses: {
        200: {
          description: "The computed quote.",
          ...json(jsonSchemaOf(quoteResponseSchema, "output")),
        },
        401: errorResponse("Not authenticated."),
        422: errorResponse("No active pricing rule covers that route and weight."),
      },
    },
  },
  "/pricing/rules": {
    get: {
      operationId: "admin.pricing.list",
      summary: "List pricing rules",
      description:
        "Paginated, sortable view of pricing rules. Filter by status, zone pair or free-text name.",
      tags: ["pricing-rules"],
      security: bearerSecurity,
      parameters: rulesListParams(),
      responses: {
        200: {
          description: "A page of pricing rules.",
          ...json(pageSchema(jsonSchemaOf(pricingRuleResponseSchema, "output"))),
        },
        401: errorResponse("Not authenticated."),
        403: errorResponse("Missing `pricing.view` permission."),
      },
    },
    post: {
      operationId: "admin.pricing.create",
      summary: "Create a pricing rule",
      tags: ["pricing-rules"],
      security: bearerSecurity,
      requestBody: { required: true, ...json(jsonSchemaOf(createPricingRuleSchema, "input")) },
      responses: {
        201: {
          description: "Created.",
          ...json(jsonSchemaOf(pricingRuleResponseSchema, "output")),
        },
        401: errorResponse("Not authenticated."),
        403: errorResponse("Missing `pricing.manage` permission."),
        409: errorResponse("A pricing rule with that zone pair and weight band already exists."),
        422: errorResponse("Validation failed."),
      },
    },
  },
  "/pricing/rules/match": {
    get: {
      operationId: "admin.pricing.match",
      summary: "Find the active pricing rule for a route and weight",
      tags: ["pricing-rules"],
      security: bearerSecurity,
      parameters: rulesMatchParams(),
      responses: {
        200: {
          description: "The matching pricing rule.",
          ...json(jsonSchemaOf(pricingRuleResponseSchema, "output")),
        },
        401: errorResponse("Not authenticated."),
        403: errorResponse("Missing `pricing.view` permission."),
        404: errorResponse("No active pricing rule covers that route and weight."),
      },
    },
  },
  "/pricing/rules/{id}": {
    get: {
      operationId: "admin.pricing.read",
      summary: "Read a pricing rule",
      tags: ["pricing-rules"],
      security: bearerSecurity,
      parameters: [rulesIdParam()],
      responses: {
        200: {
          description: "The pricing rule.",
          ...json(jsonSchemaOf(pricingRuleResponseSchema, "output")),
        },
        401: errorResponse("Not authenticated."),
        403: errorResponse("Missing `pricing.view` permission."),
        404: errorResponse("No such pricing rule."),
      },
    },
    patch: {
      operationId: "admin.pricing.update",
      summary: "Update a pricing rule",
      tags: ["pricing-rules"],
      security: bearerSecurity,
      parameters: [rulesIdParam()],
      requestBody: { required: true, ...json(jsonSchemaOf(updatePricingRuleSchema, "input")) },
      responses: {
        200: {
          description: "Updated.",
          ...json(jsonSchemaOf(pricingRuleResponseSchema, "output")),
        },
        401: errorResponse("Not authenticated."),
        403: errorResponse("Missing `pricing.manage` permission."),
        404: errorResponse("No such pricing rule."),
        409: errorResponse("A pricing rule with that zone pair and weight band already exists."),
        422: errorResponse("Validation failed."),
      },
    },
    delete: {
      operationId: "admin.pricing.delete",
      summary: "Delete a pricing rule",
      tags: ["pricing-rules"],
      security: bearerSecurity,
      parameters: [rulesIdParam()],
      responses: {
        204: { description: "Deleted." },
        401: errorResponse("Not authenticated."),
        403: errorResponse("Missing `pricing.manage` permission."),
        404: errorResponse("No such pricing rule."),
      },
    },
  },
} as const

export const pricingTags = [
  { name: "pricing", description: "Server-side delivery-fee quoting." },
  { name: "pricing-rules", description: "Zone-pair and weight-band pricing rules CRUD." },
]
