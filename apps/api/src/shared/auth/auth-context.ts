import type { Id } from "@dropx/db"

/**
 * Who is calling.
 *
 * `AuthContext` is produced by middleware once per request and passed into
 * services. Services never read cookies or headers themselves — that keeps
 * business rules testable and stops auth checks from drifting per handler.
 */
export type ActorKind = "customer" | "staff" | "rider" | "public"

/** Which app the token was minted for. Prevents cross-app route access. */
export type Audience = "console" | "riders" | "web"

export type StaffAuth = {
  kind: "staff"
  userId: Id
  email: string
  roles: string[]
  permissions: ReadonlySet<string>
  /** `users.branch_id` — set for branch-scoped staff. */
  branchId: Id | null
  /** `user_hubs` — set for hub-scoped staff. */
  hubIds: Id[]
}

export type RiderAuth = {
  kind: "rider"
  userId: Id
  riderId: Id
  hubId: Id
  email: string
  roles: string[]
  permissions: ReadonlySet<string>
  branchId: Id | null
}

export type CustomerAuth = {
  kind: "customer"
  customerId: Id
  /** `TEMP` customers hold a session but are blocked from portal operations. */
  status: "TEMP" | "ACTIVE"
}

export type PublicAuth = {
  kind: "public"
}

export type AuthContext = {
  audience: Audience
  actor: StaffAuth | RiderAuth | CustomerAuth | PublicAuth
  sessionId: Id
}

export function isStaff(auth: AuthContext): auth is AuthContext & { actor: StaffAuth } {
  return auth.actor.kind === "staff"
}

export function isRider(auth: AuthContext): auth is AuthContext & { actor: RiderAuth } {
  return auth.actor.kind === "rider"
}

export function isCustomer(auth: AuthContext): auth is AuthContext & { actor: CustomerAuth } {
  return auth.actor.kind === "customer"
}

export function isAuthenticated(auth: AuthContext): boolean {
  return auth.actor.kind !== "public"
}

/**
 * The scoping predicate every branch/hub-owned query must carry.
 *
 * DropX is single-tenant, so there is no `org_id` to filter on. The equivalent
 * guard is *scope*: admins see everything, branch staff are limited to their
 * `branch_id`, hub operators to their `user_hubs`. A repository that ignores
 * this is the tenancy anti-pattern in a single-tenant codebase.
 */
export type Scope = {
  userId: Id
  /** `null` means company-wide (ADMIN). */
  branchId: Id | null
  /** Empty means "no hub restriction" — only valid for non-hub-scoped roles. */
  hubIds: Id[]
  isCompanyWide: boolean
}

export const COMPANY_WIDE_SCOPE_KEY = "__company_wide__"

export function scopeFromAuth(auth: AuthContext): Scope {
  const actor = auth.actor

  if (actor.kind === "staff" || actor.kind === "rider") {
    return {
      userId: actor.userId,
      branchId: actor.branchId,
      hubIds: actor.kind === "rider" ? [actor.hubId] : actor.hubIds,
      isCompanyWide: actor.roles.includes("ADMIN"),
    }
  }

  return { userId: "", branchId: null, hubIds: [], isCompanyWide: false }
}

export function actorId(auth: AuthContext): Id | null {
  switch (auth.actor.kind) {
    case "staff":
    case "rider":
      return auth.actor.userId
    case "customer":
      return auth.actor.customerId
    case "public":
      return null
  }
}
