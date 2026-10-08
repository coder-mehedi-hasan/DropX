import { bearerSecurity, errorResponse } from "../components"
import { jsonSchemaOf, pageSchema, propertySchemaOf } from "../schema"
import {
  jobDetailResponseSchema,
  jobIdParamSchema,
  jobResponseSchema,
  pickupJobResponseSchema,
  listJobsQuerySchema,
  listPickupJobsQuerySchema,
  updatePickupJobStatusSchema,
  updateJobStatusSchema,
} from "../../modules/jobs/jobs.dto"
import {
  reportLocationSchema,
  riderLocationResponseSchema,
} from "../../modules/riders/rider-locations.dto"
import {
  deliveryProofResponseSchema,
  submitProofSchema,
} from "../../modules/deliveries/delivery-proofs.dto"

/**
 * `jobs` operations — the rider app's surface.
 *
 * Gated on `rider.jobs.*` rather than the admin's `parcels.*` keys, so a rider
 * token can never reach an admin operation, and the payload is scoped to the
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

const pickupListParams = () => {
  const schema = jsonSchemaOf(listPickupJobsQuerySchema, "input")
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
  "/jobs/pickups": {
    get: {
      operationId: "job.pickupList",
      summary: "List my pickup jobs",
      description:
        "Lists pickup collections assigned to the signed-in rider. Scope is always the rider from the token.",
      tags: ["jobs"],
      security: bearerSecurity,
      parameters: pickupListParams(),
      responses: {
        200: {
          description: "A page of pickup jobs.",
          ...json(pageSchema(jsonSchemaOf(pickupJobResponseSchema, "output"))),
        },
        401: unauth,
        403: forbidden,
      },
    },
  },
  "/jobs/pickups/{id}/status": {
    patch: {
      operationId: "job.pickupStatus",
      summary: "Update my pickup job",
      description:
        "Starts an assigned pickup, marks it picked up, or records why the collection failed. The pickup must belong to the signed-in rider.",
      tags: ["jobs"],
      security: bearerSecurity,
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: propertySchemaOf(jobIdParamSchema, "id"),
          description: "Pickup id assigned to the signed-in rider.",
        },
      ],
      requestBody: {
        required: true,
        ...json(jsonSchemaOf(updatePickupJobStatusSchema, "input")),
      },
      responses: {
        200: {
          description: "The updated pickup job.",
          ...json(jsonSchemaOf(pickupJobResponseSchema, "output")),
        },
        401: unauth,
        403: forbidden,
        404: errorResponse("No such pickup for this rider."),
        409: errorResponse("The pickup cannot move from its current status."),
        422: errorResponse("Validation failed — a reason is required for FAILED."),
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
  "/jobs/{id}/proofs": {
    get: {
      operationId: "job.listProofs",
      summary: "List proofs filed on one of my jobs",
      description:
        "The proofs recorded against the attempts the signed-in rider holds for this parcel, newest first. A bare array, not a page: an attempt has bounded proof rows and the rider app renders them all.",
      tags: ["jobs"],
      security: bearerSecurity,
      parameters: [idParam],
      responses: {
        200: {
          description: "The proofs.",
          ...json({ type: "array", items: jsonSchemaOf(deliveryProofResponseSchema, "output") }),
        },
        401: unauth,
        403: forbidden,
        404: errorResponse("No such job for this rider."),
      },
    },
  },
  "/jobs/proofs": {
    post: {
      operationId: "job.submitProof",
      summary: "File proof of delivery",
      description:
        "Records a signature image, photo, receiver OTP, or ID check against the attempt the signed-in rider holds for the parcel. Accepted while the attempt is out for delivery or delivered; `OTP` and `IDENTITY` need `value`, `SIGNATURE` and `PHOTO` need `fileUrl`. Writes are unverified — an office verifies.",
      tags: ["jobs"],
      security: bearerSecurity,
      requestBody: { required: true, ...json(jsonSchemaOf(submitProofSchema, "input")) },
      responses: {
        201: {
          description: "Recorded.",
          ...json(jsonSchemaOf(deliveryProofResponseSchema, "output")),
        },
        401: unauth,
        403: errorResponse("Wrong audience, or missing `rider.proof.submit`."),
        404: errorResponse("No such job for this rider."),
        409: errorResponse("The attempt is not in a state that accepts proof."),
        422: errorResponse(
          "Validation failed — OTP/IDENTITY need a value, SIGNATURE/PHOTO need a file.",
        ),
      },
    },
  },
  "/jobs/locations": {
    post: {
      operationId: "job.recordLocation",
      summary: "Report where I am",
      description:
        "Appends a position fix to the signed-in rider's trail. The rider is taken from the token and never from the body. `recordedAt` is the device clock and is optional; a fix dated too far in the future is rejected so a wrong clock cannot pin a rider's position permanently.",
      tags: ["rider-locations"],
      security: bearerSecurity,
      requestBody: { required: true, ...json(jsonSchemaOf(reportLocationSchema, "input")) },
      responses: {
        201: {
          description: "Recorded.",
          ...json(jsonSchemaOf(riderLocationResponseSchema, "output")),
        },
        401: unauth,
        403: errorResponse("Wrong audience, or missing `rider.location.update`."),
        404: errorResponse("The token's rider no longer exists."),
        422: errorResponse("Validation failed — the instant is unparseable or in the future."),
      },
    },
  },
} as const

export const jobsTags = [
  { name: "jobs", description: "Rider delivery jobs and outcome reporting." },
  {
    name: "rider-locations",
    description: "Where riders are. Fixes are pushed by the rider app and read by dispatch.",
  },
]
