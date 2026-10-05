import { errorResponse } from "../components"
import { jsonSchemaOf } from "../schema"
import {
  riderApplicationResponseSchema,
  riderApplicationSchema,
} from "../../modules/rider-applications/rider-applications.dto"

export const riderApplicationPaths = {
  "/rider-applications": {
    post: {
      operationId: "riderApplication.create",
      summary: "Submit a rider application",
      description: "Public form submission for people interested in joining DropX as riders.",
      tags: ["rider applications"],
      security: [],
      requestBody: {
        required: true,
        content: { "application/json": { schema: jsonSchemaOf(riderApplicationSchema, "input") } },
      },
      responses: {
        201: {
          description: "Application received.",
          content: {
            "application/json": { schema: jsonSchemaOf(riderApplicationResponseSchema, "output") },
          },
        },
        400: errorResponse("Some fields need attention."),
      },
    },
  },
} as const

export const riderApplicationTags = [
  { name: "rider applications", description: "Public rider recruitment submissions." },
]
