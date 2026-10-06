import { z } from "zod"

/**
 * Roles and their permission grants.
 *
 * Batch 1 shipped the list read (the user form's role picker); Batch 2 adds
 * `read`, `create` and `replacePermissions` for the permission matrix in the
 * same DTO, so there is one module and one policy declaration for the whole
 * RBAC surface.
 *
 * No `.default()` on list fields — the defaults live in the pagination
 * arithmetic (P0 §3.3).
 */
export const listRolesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["name", "createdAt"]).default("createdAt"),
  sort: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().trim().max(100).optional(),
})

export type ListRolesQuery = z.infer<typeof listRolesQuerySchema>

/**
 * The roles table carries `created_at` but no `updated_at` (see
 * `migrate.sql`), so the projection is `EntityBase + createdAt` rather than the
 * `Timestamped` shape — the wire never promises a column the table does not
 * have.
 */
export const roleResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
})

export type RoleResponse = z.infer<typeof roleResponseSchema>

export const roleIdParamSchema = z.object({ id: z.string().trim().min(1) })

/**
 * A role is created empty and granted keys by a separate PUT. One body that
 * did both would make "create a read-only role" two fields' worth of optional
 * state on create, and the matrix sheet would still have to re-send the whole
 * set on every edit anyway. Lengths match the columns (`VARCHAR(100)` /
 * `VARCHAR(255)`) so validation fails as a 422 before the driver ever sees it.
 */
export const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(255).nullable().optional(),
})

export type CreateRoleInput = z.infer<typeof createRoleSchema>

/**
 * The whole key set, replaced — the same shape `PUT /routes/:id/stops` and
 * `PUT /transfers/:id/parcels` use, for the same reason: the matrix *is* the
 * set, so add-and-remove in one body beats two operations that race each
 * other. Membership in the static catalog is checked in the service, where the
 * 422 can name the offending key in `details`.
 */
export const replacePermissionsSchema = z.object({
  permissionKeys: z
    .array(z.string().trim().min(1))
    .max(100)
    .refine((keys) => new Set(keys).size === keys.length, {
      message: "The same permission was listed twice",
    }),
})

export type ReplacePermissionsInput = z.infer<typeof replacePermissionsSchema>

/**
 * One row per static key, in catalog order, flagged granted or not — the
 * matrix renders from this single response instead of a detail read stitched
 * to a separate grants read in the client.
 */
export const permissionGrantSchema = z.object({
  key: z.string(),
  granted: z.boolean(),
})

export type PermissionGrant = z.infer<typeof permissionGrantSchema>

export const roleDetailResponseSchema = roleResponseSchema.extend({
  permissions: z.array(permissionGrantSchema),
})

export type RoleDetailResponse = z.infer<typeof roleDetailResponseSchema>
