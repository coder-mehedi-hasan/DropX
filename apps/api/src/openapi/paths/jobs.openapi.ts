import { bearerSecurity, errorResponse } from "../components"
import { jsonSchemaOf, pageSchema, propertySchemaOf } from "../schema"
import {
  jobDetailResponseSchema,
  jobIdParamSchema,
  jobResponseSchema,
  listJobsQuerySchema,
  updateJobStatusSchema,
} from "../../modules/jobs/jobs.dto"

/**
 * `jobs` operations — the rider app's surface.
 *
 * Gated on `rider.jobs.*` rather than the console's `parcels.*` keys, so a rider
 * token can never reach a console operation, and the payload is scoped to the
 * rider's own assignments in the repository. `:id` is the parcel id; the rider
 * is never asked for, and never sends, a rider id.
 */

const json = (schema: ReturnType<typeof jsonSchemaOf>) => ({
  content: { "application/json": { schema } },
})

const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: propertySchemaOf(jobIdParamSchema, "id"),
  description: "Parcel id of an attempt assigned to the signed-in rider.",
} as const

const listParams = () => {
  const schema = jsonSchemaOf(listJobsQuerySchema, "input")
  return Object.entries(schema.properties as Record<string, any>).map(([name, propertySchema]) => ({
    name,
    in: "query",
    required: Boolean((schema.required as string[] | undefined)?.includes(name)),
    schema: propertySchema,
  }))
}

const unauth = errorResponse("Not authenticated, or the token is missing/expired.")
const forbidden = errorResponse("Wrong audience, or missing `rider.jobs.*`.")

export const jobsPaths = {
  "/jobs": {
    get: {
      operationId: "job.list",
      summary: "List my jobs",
      description:
        "The rider's delivery attempts. Omit `status` to get every attempt across all statuses; scope is always the signed-in rider, never a filter the client controls.",
      tags: ["jobs"],
      security: bearerSecurity,
      parameters: listParams(),
      responses: {
        200: {
          description: "A page of jobs.",
          ...json(pageSchema(jsonSchemaOf(jobResponseSchema, "output"))),
        },
        401: unauth,
        403: forbidden,
      },
    },
  },
  "/jobs/{id}": {
    get: {
      operationId: "job.read",
      summary: "Read one of my jobs",
      description:
        "A single job with the parcel's items. Rejected if the attempt is not assigned to the caller.",
      tags: ["jobs"],
      security: bearerSecurity,
      parameters: [idParam],
      responses: {
        200: { description: "The job.", ...json(jsonSchemaOf(jobDetailResponseSchema, "output")) },
        401: unauth,
        403: forbidden,
        404: errorResponse("No such job for this rider."),
      },
    },
  },
  "/jobs/{id}/status": {
    patch: {
      operationId: "job.reportOutcome",
      summary: "Report a delivery outcome",
      description:
        "Moves the open delivery attempt and the customer-visible parcel status in one transaction. `FAILED` and `RETURNED` require a reason.",
      tags: ["jobs"],
      security: bearerSecurity,
      parameters: [idParam],
      requestBody: { required: true, ...json(jsonSchemaOf(updateJobStatusSchema, "input")) },
      responses: {
        200: { description: "Recorded.", ...json(jsonSchemaOf(jobDetailResponseSchema, "output")) },
        401: unauth,
        403: forbidden,
        404: errorResponse("No open attempt for this rider on that parcel."),
        409: errorResponse("The attempt is already closed, or the transition is not allowed."),
        422: errorResponse("Validation failed — a reason is required for FAILED/RETURNED."),
      },
    },
  },
} as const

export const jobsTags = [
  { name: "jobs", description: "Rider delivery jobs and outcome reporting." },
]
