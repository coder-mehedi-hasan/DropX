import { z } from "zod"

import { USER_STATUSES } from "../../db/models"

const id = z.string().trim().min(1)

export const userIdParamSchema = z.object({ id })

/**
 * List filters carry no `.default()` (P0 §3.3): the defaults live in the
 * pagination arithmetic, and a `.default()` here would also make the field
 * optional on any schema derived from it.
 */
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["name", "email", "status", "createdAt"]).default("createdAt"),
  sort: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(USER_STATUSES).optional(),
  branchId: id.optional(),
  search: z.string().trim().max(100).optional(),
})

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>

/**
 * A staff account is a `users` row plus its `user_roles` and `user_hubs` rows:
 * roles and hub scope are what make the account usable, so create writes all
 * three in one transaction. `password` is create-only — see `updateUserSchema`.
 */
export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(150),
  email: z.string().trim().email().max(150),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  phone: z.string().trim().max(30).nullish(),
  /** `null`/absent means company-wide: no branch restriction on the account. */
  branchId: id.nullish(),
  status: z.enum(USER_STATUSES).default("ACTIVE"),
  roleIds: z.array(id).min(1, "Pick at least one role"),
  hubIds: z.array(id),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

/**
 * `email` and `password` are omitted before `.partial()`, so a PATCH cannot
 * touch them at all — the same rule as riders: two surfaces writing one account
 * row is how a login drifts from the record that owns it.
 *
 * `roleIds` stays `.min(1)` when present: a PATCH may leave the set alone or
 * replace it, but never strip the account bare.
 */
export const updateUserSchema = createUserSchema.omit({ email: true, password: true }).partial()

export type UpdateUserInput = z.infer<typeof updateUserSchema>

/**
 * Availability, like `admin.riders.setStatus`, is its own operation rather than
 * one more PATCH field: it is the one account state ops flips without opening
 * the record, and it carries the last-ADMIN guard of its own.
 */
export const setUserStatusSchema = z.object({
  status: z.enum(USER_STATUSES),
})

export type SetUserStatusInput = z.infer<typeof setUserStatusSchema>

/**
 * Own operation, not a PATCH field, because writing `password_hash` is a
 * different kind of write from every other column: it is the only one that
 * cannot be retried from a stale screen. Flips `must_change_password` with it.
 */
export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
})

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

/**
 * The staff projection. `passwordHash` never leaves the server, and roles/hubs
 * ride along as `{ id, name }` so a list row and the edit form both render
 * without a second request per account.
 */
export const userResponseSchema = z.object({
  id: z.string(),
  branchId: z.string().nullable(),
  branchName: z.string().nullable(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  status: z.enum(USER_STATUSES),
  mustChangePassword: z.boolean(),
  roles: z.array(z.object({ id: z.string(), name: z.string() })),
  hubs: z.array(z.object({ id: z.string(), name: z.string() })),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type UserResponse = z.infer<typeof userResponseSchema>
