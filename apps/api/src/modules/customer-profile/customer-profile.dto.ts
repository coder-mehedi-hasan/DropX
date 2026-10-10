import { z } from "zod"

import { CUSTOMER_TYPES } from "../../db/models"

/**
 * The customer's own profile.
 *
 * What the portal can see and mutate about the account that owns the session.
 * `avatarUrl` is a public URL to a stored object — the bytes live in S3-compatible
 * storage, and a `null` means the UI falls back to initials. The session's
 * phone/email are read-only here: they are the OTP identifiers, so changing them
 * is a verification flow, not an edit field.
 */

export const customerProfileResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  type: z.enum(CUSTOMER_TYPES),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
})

export type CustomerProfileResponse = z.infer<typeof customerProfileResponseSchema>

/**
 * The only two editable profile fields. A `null` (or empty) `avatarUrl` removes
 * the picture; a name is what the portal header and every parcel row print.
 * Both optional so a client can patch one without resending the other.
 */
export const updateCustomerProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(150, "That name is too long").optional(),
  avatarUrl: z
    .union([z.string().url().max(500, "That image URL is too long"), z.literal(""), z.null()])
    .optional(),
})

export type UpdateCustomerProfileInput = z.infer<typeof updateCustomerProfileSchema>