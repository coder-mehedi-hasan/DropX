import { z } from "zod"

/**
 * Boundary DTOs for `POST /admin/bootstrap`.
 *
 * This route is the only writer to `users` in the whole codebase, so its DTOs
 * are deliberately narrow: it creates exactly one account, and it cannot create
 * a second. Everything about *subsequent* staff belongs in the admin staff
 * screen, which is authenticated and permission-checked.
 *
 * The token travels in the body rather than a header because the surface
 * registry models bodies and query/params only. It is a write-once secret, not a
 * bearer credential, so the usual "don't put tokens in bodies" objection — replay
 * out of an access log — does not apply to it.
 */

export const bootstrapAdminSchema = z.object({
  /** Compared against `BOOTSTRAP_TOKEN`. Absent config means every call is refused. */
  token: z.string().min(1),
  name: z.string().trim().min(1).max(150),
  email: z.string().trim().toLowerCase().email().max(254),
  /** Same rule as `auth.loginAdmin`, so no admin can hold a password login rejects. */
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
})

export type BootstrapAdminInput = z.infer<typeof bootstrapAdminSchema>

/** The created account. Deliberately never echoes `passwordHash` or the token. */
export const bootstrapAdminResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  status: z.string(),
  createdAt: z.string(),
})
