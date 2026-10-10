import type { Context } from "hono"

import { notFound } from "../../core"
import type { AppEnv } from "../../types/env"
import type {
  UpdateUserProfileInput,
  UserProfileResponse,
} from "./user-profile.dto"
import {
  selectUserProfile,
  updateUserProfile as updateUserProfileRow,
  type UserProfileRecord,
} from "./user-profile.repository"

/**
 * Profile rules.
 *
 * Deliberately thin: the row is the session's own (the `users` id on the token),
 * so the only question is whether it exists, and the two editable fields are
 * validated at the boundary. Email and phone are the account identifiers and
 * stay read-only here — changing them is an account flow, not a settings field.
 */

function toResponse(record: UserProfileRecord): UserProfileResponse {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    phone: record.phone,
    avatarUrl: record.avatarUrl,
    createdAt: record.createdAt,
  }
}

export async function getUserProfile(
  c: Context<AppEnv>,
  userId: string,
): Promise<UserProfileResponse> {
  const record = await selectUserProfile(c.get("db")!, userId)
  if (!record) throw notFound("No such account")
  return toResponse(record)
}

export async function updateUserProfile(
  c: Context<AppEnv>,
  userId: string,
  input: UpdateUserProfileInput,
): Promise<UserProfileResponse> {
  const record = await updateUserProfileRow(c.get("db")!, userId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.avatarUrl !== undefined
      ? { avatarUrl: input.avatarUrl === "" ? null : input.avatarUrl }
      : {}),
  })
  if (!record) throw notFound("No such account")
  return toResponse(record)
}