import { errorResponse } from "../components"
import { jsonSchemaOf, propertySchemaOf } from "../schema"
import { trackingLookupSchema, trackingResponseSchema } from "../../modules/tracking/tracking.dto"

/**
 * `tracking` — the one unauthenticated read of operational data.
 *
 * Throttled per identifier and per caller so it cannot be used as an enumeration
 * oracle. An unknown tracking number returns 404, not 403, so it is not
 * distinguishable from one the caller is not allowed to see.
 */

const json = (schema: ReturnType<typeof jsonSchemaOf>) => ({
  content: { "application/json": { schema } },
})

export const trackingPaths = {
  "/tracking/{trackingNumber}": {
    get: {
      operationId: "tracking.lookup",
      summary: "Track a parcel",
      description:
        "Public tracking by tracking number only — no login. Deliberately excludes sender/receiver identity so public tracking cannot leak unrelated PII.",
      tags: ["tracking"],
      security: [],
      parameters: [
        {
          name: "trackingNumber",
          in: "path",
          required: true,
          schema: propertySchemaOf(trackingLookupSchema, "trackingNumber"),
          description: "The tracking number printed on the booking confirmation.",
        },
      ],
      responses: {
        200: {
          description: "The parcel's public tracking projection.",
          ...json(jsonSchemaOf(trackingResponseSchema, "output")),
        },
        404: errorResponse("No parcel with that tracking number."),
        429: errorResponse("Too many lookups — wait a minute and try again."),
      },
    },
  },
} as const

export const trackingTags = [
  { name: "tracking", description: "Public tracking by tracking number (no login required)." },
]
