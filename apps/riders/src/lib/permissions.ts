/**
 * Rider permission keys.
 *
 * Mirrors `PERMISSIONS` in `apps/api/src/shared/auth/permissions.ts`. Keys are
 * static strings in code on both sides — there is no catalog table — and the
 * rider app only ever holds the four `rider.*` keys, enforced server-side by
 * `role_permissions`. These constants exist so a screen names the key it needs
 * instead of a bare literal.
 */

export const RIDER_PERMISSIONS = {
  JOBS_VIEW: "rider.jobs.view",
  JOBS_UPDATE: "rider.jobs.update",
  LOCATION_UPDATE: "rider.location.update",
  PROOF_SUBMIT: "rider.proof.submit",
} as const

export type RiderPermission = (typeof RIDER_PERMISSIONS)[keyof typeof RIDER_PERMISSIONS]

export const RIDER_PERMISSION_KEYS: RiderPermission[] = Object.values(RIDER_PERMISSIONS)
