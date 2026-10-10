import { z } from "zod"

/**
 * The signed-in user's own profile (riders and staff).
 *
 * `users` is the identity table both audiences log in against, so this surface
 * is shared: what the riders app calls "my profile" is the same row an admin
 * would edit for themselves. `avatarUrl` is a public URL to a stored object —
 * the bytes live in S3-compatible storage, and `null` means the UI falls back
 * to initials. Email and phone are read-only here: they identify the account
 * and are changed through the account administration flow, not a settings field.
 */

export const userProfileResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
})

export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>

/**
 * The only two editable profile fields. A `null` (or empty) `avatarUrl`
 * removes the picture; a name is what the rider header and job cards print.
 * Both optional so a client can patch one without resending the other.
 */
export const updateUserProfileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(150, "That name is too long").optional(),
  avatarUrl: z
    .union([z.string().url().max(500, "That image URL is too long"), z.literal(""), z.null()])
    .optional(),
})

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>