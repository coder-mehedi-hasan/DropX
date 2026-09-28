/**
 * Permission keys the admin gates on.
 *
 * A copy of the constants in `apps/api/src/shared/auth/permissions.ts`, which is
 * the single source of truth. Duplicated rather than imported because the
 * browser must not pull in the API's module graph, and because the strings here
 * are compared against what `/auth/me` returns — a typo would fail closed
 * (a hidden screen) rather than open.
 */
export const PERMISSIONS = {
  BRANCHES_VIEW: "branches.view",
  BRANCHES_MANAGE: "branches.manage",
  HUBS_VIEW: "hubs.view",
  HUBS_MANAGE: "hubs.manage",
  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",
  ROLES_VIEW: "roles.view",
  ROLES_MANAGE: "roles.manage",

  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_MANAGE: "customers.manage",
  ZONES_VIEW: "zones.view",
  ZONES_MANAGE: "zones.manage",
  PRICING_VIEW: "pricing.view",
  PRICING_MANAGE: "pricing.manage",

  VEHICLES_VIEW: "vehicles.view",
  VEHICLES_MANAGE: "vehicles.manage",
  ROUTES_VIEW: "routes.view",
  ROUTES_MANAGE: "routes.manage",
  RIDERS_VIEW: "riders.view",
  RIDERS_MANAGE: "riders.manage",

  PARCELS_VIEW: "parcels.view",
  PARCELS_CREATE: "parcels.create",
  PARCELS_UPDATE: "parcels.update",
  PARCELS_CANCEL: "parcels.cancel",
  PICKUPS_VIEW: "pickups.view",
  PICKUPS_MANAGE: "pickups.manage",
  PICKUPS_ASSIGN: "pickups.assign",
  TRANSFERS_VIEW: "transfers.view",
  TRANSFERS_MANAGE: "transfers.manage",
  DELIVERIES_VIEW: "deliveries.view",
  DELIVERIES_MANAGE: "deliveries.manage",
  DELIVERIES_ASSIGN: "deliveries.assign",

  PAYMENTS_VIEW: "payments.view",
  PAYMENTS_MANAGE: "payments.manage",
  SETTLEMENTS_VIEW: "settlements.view",
  SETTLEMENTS_MANAGE: "settlements.manage",
  NOTIFICATIONS_VIEW: "notifications.view",
  SUPPORT_VIEW: "support.view",
  SUPPORT_MANAGE: "support.manage",
  AUDIT_VIEW: "audit.view",
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const RIDER_PERMISSION_PREFIX = "rider."

/**
 * `rider.*` keys are never granted to an admin session — the rider app has its
 * own audience — so they are excluded when reporting what a user can do here.
 */
export function isAdminPermission(key: string): key is PermissionKey {
  return !key.startsWith(RIDER_PERMISSION_PREFIX)
}
