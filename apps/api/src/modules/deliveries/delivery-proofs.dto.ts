import { z } from "zod"

import { PROOF_TYPES } from "../../db/models"

const id = z.string().trim().min(1)

export const listDeliveryProofsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "type"]).default("createdAt"),
  sort: z.enum(["asc", "desc"]).default("desc"),
  type: z.enum(PROOF_TYPES).optional(),
  /** "true" for verified rows, "false" for unverified. */
  verified: z.enum(["true", "false"]).optional(),
  deliveryId: id.optional(),
  search: z.string().trim().max(100).optional(),
})
export type ListDeliveryProofsQuery = z.infer<typeof listDeliveryProofsQuerySchema>

export const deliveryProofIdParamSchema = z.object({ id })

/**
 * Proof accepted per type, so the rider is never asked for a signature image
 * on an OTP delivery or a 6-digit code on a signature one:
 *
 * - `OTP` / `IDENTITY` — the receiver's code or ID number in `value`.
 * - `SIGNATURE` / `PHOTO` — an uploaded artefact referenced by `fileUrl`.
 *
 * `deliveryId` is never taken from the body — the attempt is resolved from
 * the rider's own parcel: the id identifies which job, never which delivery.
 */
export const submitProofSchema = z
  .object({
    parcelId: id,
    type: z.enum(PROOF_TYPES),
    value: z.string().trim().max(500).optional(),
    fileUrl: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "OTP" || value.type === "IDENTITY") {
      if (!value.value) {
        ctx.addIssue({ code: "custom", path: ["value"], message: "Required for OTP and ID proof" })
      }
    } else if (!value.fileUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["fileUrl"],
        message: "A signature or photo needs a file",
      })
    }
  })
export type SubmitProofInput = z.infer<typeof submitProofSchema>

export const deliveryProofResponseSchema = z.object({
  id: z.string(),
  deliveryId: z.string(),
  type: z.enum(PROOF_TYPES),
  value: z.string().nullable(),
  fileUrl: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  createdAt: z.string(),
})
export type DeliveryProofResponse = z.infer<typeof deliveryProofResponseSchema>

/** The admin list row: the proof plus the attempt/parcel/rider it belongs to. */
export const deliveryProofListItemSchema = deliveryProofResponseSchema.extend({
  parcelTrackingNumber: z.string(),
  attemptNo: z.number(),
  riderName: z.string(),
  riderEmployeeCode: z.string(),
  hubName: z.string(),
})
export type DeliveryProofListItem = z.infer<typeof deliveryProofListItemSchema>
