/**
 * Physical table names.
 *
 * SQL lives in feature folders, so they reference these constants rather than
 * repeating string literals. A rename touches one file.
 */
export const TABLES = {
  roles: "roles",
  branches: "branches",
  hubs: "hubs",
  users: "users",
  userRoles: "user_roles",
  rolePermissions: "role_permissions",
  userHubs: "user_hubs",
  customers: "customers",
  customerAddresses: "customer_addresses",
  zones: "zones",
  pricingRules: "pricing_rules",
  vehicles: "vehicles",
  routes: "routes",
  routeStops: "route_stops",
  riders: "riders",
  riderLocations: "rider_locations",
  parcels: "parcels",
  parcelItems: "parcel_items",
  pickups: "pickups",
  transfers: "transfers",
  transferParcels: "transfer_parcels",
  deliveries: "deliveries",
  deliveryProofs: "delivery_proofs",
  parcelEvents: "parcel_events",
  payments: "payments",
  settlements: "settlements",
  notifications: "notifications",
  supportTickets: "support_tickets",
  auditLogs: "audit_logs",
} as const;

export type TableName = (typeof TABLES)[keyof typeof TABLES];
