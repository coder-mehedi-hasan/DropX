import type { Id } from "../port/database";

/**
 * Shared domain models.
 *
 * These are the *decoded* shapes services and transports work with: ids are
 * `string` (BIGINT UNSIGNED never loses precision), decimals are `number`,
 * timestamps are `Date`. Raw driver rows are converted in repositories via
 * `src/codecs.ts` — the string-typed storage artifacts stop there.
 */

export type EntityBase = {
  id: Id;
};

export type CreatedAt = {
  createdAt: Date;
};

export type UpdatedAt = {
  updatedAt: Date;
};

export type Timestamped = CreatedAt & UpdatedAt;

export type Nullable<T> = T | null;

/** Discriminator written to `audit_logs.entity_type`. */
export const ENTITY_NAMES = [
  "branch",
  "hub",
  "user",
  "role",
  "customer",
  "customer_address",
  "zone",
  "pricing_rule",
  "vehicle",
  "route",
  "route_stop",
  "rider",
  "parcel",
  "parcel_item",
  "pickup",
  "transfer",
  "delivery",
  "delivery_proof",
  "parcel_event",
  "payment",
  "settlement",
  "notification",
  "support_ticket",
] as const;

export type EntityName = (typeof ENTITY_NAMES)[number];
