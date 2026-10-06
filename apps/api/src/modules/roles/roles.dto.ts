import { z } from "zod"

/**
 * Roles, Batch 1 slice: the list read that feeds the user form's role picker.
 * `admin.roles.{read,create,replacePermissions}` land with Batch 2's permission
 * matrix and extend this DTO rather than opening a second one.
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
