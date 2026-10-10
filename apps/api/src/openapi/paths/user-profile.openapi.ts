import { jsonSchemaOf } from "../schema"
import {
  updateUserProfileSchema,
  userProfileResponseSchema,
} from "../../modules/user-profile/user-profile.dto"

/**
 * `user-profile` operations.
 *
 * The signed-in user's own profile, shared by the riders and admin audiences —
 * both authenticate as a `users` account. Email and phone are read-only
 * identifiers; only `name` and `avatarUrl` are editable.
 */

const json = (schema: ReturnType<typeof jsonSchemaOf>) => ({
  content: { "application/json": { schema } },
})

export const userProfilePaths = {
  "/user/profile": {
    get: {
      operationId: "userProfile.read",
      summary: "Read your own profile",
      description:
        "Returns the name, email, phone and avatar of the signed-in rider or staff account.",
      tags: ["user"],
      responses: {
        200: {
          description: "The signed-in account's profile.",
          ...json(jsonSchemaOf(userProfileResponseSchema, "output")),
        },
        401: { description: "You are not signed in." },
        403: { description: "This surface is for signed-in staff and riders." },
      },
    },
    patch: {
      operationId: "userProfile.update",
      summary: "Update your own profile",
      description:
        "Edits the display name and/or avatar URL of the signed-in rider or staff account. `avatarUrl` `null` or an empty string removes the picture; the bytes themselves come from `POST /uploads` with purpose `avatar`.",
      tags: ["user"],
      requestBody: {
        required: true,
        content: { "application/json": { schema: jsonSchemaOf(updateUserProfileSchema, "input") } },
      },
      responses: {
        200: {
          description: "The updated profile.",
          ...json(jsonSchemaOf(userProfileResponseSchema, "output")),
        },
        422: {
          description: "Invalid name or avatar URL.",
        },
      },
    },
  },
} as const

export const userProfileTags = [
  { name: "user", description: "The signed-in staff or rider account editing its own profile." },
]