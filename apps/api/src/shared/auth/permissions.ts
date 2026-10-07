/**
 * Permission keys — static in code, by design.
 *
 * `role_permissions.permission_key` is a plain string column; there is
 * deliberately **no `permissions` catalog table**. This object is the only
 * place a key is defined, and `docs/rbac.md` mirrors it. Add a key here, then
 * grant it to roles via `role_permissions` (see `apps/api/scripts/seed.ts`).
 *
 * Shape: `{domain}.{resource}.{action}`.
 */
export const PERMISSIONS = {
  // --- organization ---
  BRANCHES_VIEW: "branches.view",
  BRANCHES_MANAGE: "branches.manage",
  HUBS_VIEW: "hubs.view",
  HUBS_MANAGE: "hubs.manage",
  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",
  ROLES_VIEW: "roles.view",
  ROLES_MANAGE: "roles.manage",

  // --- customers & pricing ---
  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_MANAGE: "customers.manage",
  LOCATIONS_VIEW: "locations.view",
  LOCATIONS_MANAGE: "locations.manage",
  PRICING_VIEW: "pricing.view",
  PRICING_MANAGE: "pricing.manage",

  // --- fleet & network ---
  VEHICLES_VIEW: "vehicles.view",
  VEHICLES_MANAGE: "vehicles.manage",
  ROUTES_VIEW: "routes.view",
  ROUTES_MANAGE: "routes.manage",
  RIDERS_VIEW: "riders.view",
  RIDERS_MANAGE: "riders.manage",

  // --- parcels & operations ---
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

  // --- money & support ---
  PAYMENTS_VIEW: "payments.view",
  PAYMENTS_MANAGE: "payments.manage",
  SETTLEMENTS_VIEW: "settlements.view",
  SETTLEMENTS_MANAGE: "settlements.manage",
  NOTIFICATIONS_VIEW: "notifications.view",
  SUPPORT_VIEW: "support.view",
  SUPPORT_MANAGE: "support.manage",
  AUDIT_VIEW: "audit.view",

  // --- rider app ---
  RIDER_JOBS_VIEW: "rider.jobs.view",
  RIDER_JOBS_UPDATE: "rider.jobs.update",
  RIDER_LOCATION_UPDATE: "rider.location.update",
  RIDER_PROOF_SUBMIT: "rider.proof.submit",
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const ALL_PERMISSION_KEYS: PermissionKey[] = Object.values(PERMISSIONS)

/** Groups used by the seeder to build default role grants. */
export const ADMIN_PERMISSION_KEYS = ALL_PERMISSION_KEYS.filter((key) => !key.startsWith("rider."))

export const RIDER_PERMISSION_KEYS: PermissionKey[] = [
  PERMISSIONS.RIDER_JOBS_VIEW,
  PERMISSIONS.RIDER_JOBS_UPDATE,
  PERMISSIONS.RIDER_LOCATION_UPDATE,
  PERMISSIONS.RIDER_PROOF_SUBMIT,
]

/**
 * Default grants per role, matching `docs/rbac.md`.
 *
 * Only used to seed `role_permissions`; a role edited in the admin keeps its
 * own rows afterwards.
 */
export const DEFAULT_ROLE_GRANTS: Readonly<Record<string, PermissionKey[]>> = {
  ADMIN: ADMIN_PERMISSION_KEYS,

  BRANCH_MANAGER: [
    PERMISSIONS.HUBS_VIEW,
    PERMISSIONS.HUBS_MANAGE,
    // Zones are company-wide, non-sensitive reference data (name, code, status),
    // and this role books parcels — which is what the city/zone/area pickers are.
    // Without a read key every location picker 403s for a branch manager while
    // working fine for ADMIN, so the gate would pass against a superadmin and
    // fail in real use. Read only: `locations.manage` is territory configuration
    // and stays with ADMIN.
    PERMISSIONS.LOCATIONS_VIEW,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.RIDERS_VIEW,
    PERMISSIONS.RIDERS_MANAGE,
    PERMISSIONS.PARCELS_VIEW,
    PERMISSIONS.PARCELS_CREATE,
    PERMISSIONS.PARCELS_UPDATE,
    PERMISSIONS.PARCELS_CANCEL,
    PERMISSIONS.PICKUPS_VIEW,
    PERMISSIONS.PICKUPS_MANAGE,
    PERMISSIONS.PICKUPS_ASSIGN,
    PERMISSIONS.TRANSFERS_VIEW,
    PERMISSIONS.TRANSFERS_MANAGE,
    PERMISSIONS.DELIVERIES_VIEW,
    PERMISSIONS.DELIVERIES_MANAGE,
    PERMISSIONS.DELIVERIES_ASSIGN,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_MANAGE,
    PERMISSIONS.VEHICLES_VIEW,
    PERMISSIONS.ROUTES_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.SUPPORT_VIEW,
    PERMISSIONS.SUPPORT_MANAGE,
  ],

  HUB_OPERATOR: [
    PERMISSIONS.HUBS_VIEW,
    PERMISSIONS.PARCELS_VIEW,
    PERMISSIONS.PARCELS_UPDATE,
    PERMISSIONS.PICKUPS_VIEW,
    PERMISSIONS.PICKUPS_MANAGE,
    PERMISSIONS.PICKUPS_ASSIGN,
    PERMISSIONS.TRANSFERS_VIEW,
    PERMISSIONS.TRANSFERS_MANAGE,
    PERMISSIONS.DELIVERIES_VIEW,
    PERMISSIONS.DELIVERIES_MANAGE,
    PERMISSIONS.DELIVERIES_ASSIGN,
    PERMISSIONS.RIDERS_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
  ],

  DISPATCHER: [
    PERMISSIONS.PARCELS_VIEW,
    PERMISSIONS.PICKUPS_VIEW,
    PERMISSIONS.PICKUPS_ASSIGN,
    PERMISSIONS.DELIVERIES_VIEW,
    PERMISSIONS.DELIVERIES_ASSIGN,
    PERMISSIONS.TRANSFERS_VIEW,
    PERMISSIONS.RIDERS_VIEW,
    PERMISSIONS.HUBS_VIEW,
    PERMISSIONS.ROUTES_VIEW,
  ],

  SUPPORT: [
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.PARCELS_VIEW,
    PERMISSIONS.SUPPORT_VIEW,
    PERMISSIONS.SUPPORT_MANAGE,
    PERMISSIONS.NOTIFICATIONS_VIEW,
  ],

  FINANCE: [
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_MANAGE,
    PERMISSIONS.SETTLEMENTS_VIEW,
    PERMISSIONS.SETTLEMENTS_MANAGE,
    PERMISSIONS.PARCELS_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.PRICING_VIEW,
  ],

  RIDER: RIDER_PERMISSION_KEYS,
}

export function hasPermission(granted: ReadonlySet<string>, required: string): boolean {
  return granted.has(required)
}
