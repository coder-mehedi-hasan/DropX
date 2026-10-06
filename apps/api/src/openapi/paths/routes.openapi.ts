import { z } from "zod"

import { bearerSecurity, errorResponse } from "../components"
import { jsonSchemaOf, pageSchema, propertySchemaOf } from "../schema"
import {
  createRouteSchema,
  listRoutesQuerySchema,
  routeIdParamSchema,
  routeResponseSchema,
  routeStopResponseSchema,
  updateRouteSchema,
  updateStopsSchema,
} from "../../modules/routes/routes.dto"

const json = (schema: ReturnType<typeof jsonSchemaOf>) => ({
  content: { "application/json": { schema } },
})

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

const routesListParams = () => queryParamsOf(listRoutesQuerySchema)

const routeIdParam = () => ({
  name: "id",
  in: "path",
  required: true,
  schema: propertySchemaOf(routeIdParamSchema, "id"),
  description: "Route id.",
})

const unauth = errorResponse("Not authenticated.")
const forbidden = errorResponse("Missing permission key.")

export const routesPaths = {
  "/routes": {
    get: {
      operationId: "admin.routes.list",
      summary: "List routes",
      tags: ["routes"],
      security: bearerSecurity,
      parameters: routesListParams(),
      responses: {
        200: {
          description: "A page of routes.",
          ...json(pageSchema(jsonSchemaOf(routeResponseSchema, "output"))),
        },
        401: unauth,
        403: forbidden,
      },
    },
    post: {
      operationId: "admin.routes.create",
      summary: "Create a route",
      tags: ["routes"],
      security: bearerSecurity,
      requestBody: { required: true, ...json(jsonSchemaOf(createRouteSchema, "input")) },
      responses: {
        201: { description: "Created.", ...json(jsonSchemaOf(routeResponseSchema, "output")) },
        401: unauth,
        403: forbidden,
        409: errorResponse("A route with that code already exists."),
        422: errorResponse("Validation failed."),
      },
    },
  },
  "/routes/{id}": {
    get: {
      operationId: "admin.routes.read",
      summary: "Read a route",
      tags: ["routes"],
      security: bearerSecurity,
      parameters: [routeIdParam()],
      responses: {
        200: { description: "The route.", ...json(jsonSchemaOf(routeResponseSchema, "output")) },
        401: unauth,
        403: forbidden,
        404: errorResponse("No such route."),
      },
    },
    patch: {
      operationId: "admin.routes.update",
      summary: "Update a route",
      tags: ["routes"],
      security: bearerSecurity,
      parameters: [routeIdParam()],
      requestBody: { required: true, ...json(jsonSchemaOf(updateRouteSchema, "input")) },
      responses: {
        200: { description: "Updated.", ...json(jsonSchemaOf(routeResponseSchema, "output")) },
        401: unauth,
        403: forbidden,
        404: errorResponse("No such route."),
        409: errorResponse("A route with that code already exists."),
        422: errorResponse("Validation failed."),
      },
    },
    delete: {
      operationId: "admin.routes.delete",
      summary: "Delete a route",
      tags: ["routes"],
      security: bearerSecurity,
      parameters: [routeIdParam()],
      responses: {
        204: { description: "Deleted." },
        401: unauth,
        403: forbidden,
        404: errorResponse("No such route."),
      },
    },
  },
  "/routes/{id}/stops": {
    get: {
      operationId: "admin.routes.stopsList",
      summary: "List stops on a route",
      tags: ["routes"],
      security: bearerSecurity,
      parameters: [routeIdParam()],
      responses: {
        200: {
          description: "The ordered stops.",
          ...json({ type: "array", items: jsonSchemaOf(routeStopResponseSchema, "output") }),
        },
        401: unauth,
        403: forbidden,
        404: errorResponse("No such route."),
      },
    },
    put: {
      operationId: "admin.routes.stopsReplace",
      summary: "Replace the stops on a route",
      description:
        "Ordered hub stops for this route, in sequence-number order. Replaces all existing stops.",
      tags: ["routes"],
      security: bearerSecurity,
      parameters: [routeIdParam()],
      requestBody: { required: true, ...json(jsonSchemaOf(updateStopsSchema, "input")) },
      responses: {
        200: {
          description: "The stored stops.",
          ...json({ type: "array", items: jsonSchemaOf(routeStopResponseSchema, "output") }),
        },
        401: unauth,
        403: forbidden,
        404: errorResponse("No such route."),
        422: errorResponse("Validation failed."),
      },
    },
  },
} as const

export const routesTags = [{ name: "routes", description: "Hub-to-hub routes and their stops." }]
