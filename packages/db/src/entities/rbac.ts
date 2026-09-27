import type { Id } from "../port/database";
import type { EntityBase, Nullable, Timestamped } from "./base";

/**
 * RBAC.
 *
 * Permission keys are NOT modelled here — they are static strings in
 * `apps/api` (see `docs/rbac.md`). `RolePermission` only records which keys a
 * role was granted; there is deliberately no `permissions` catalog table.
 */

export type Role = EntityBase & Timestamped & {
  name: RoleName | (string & {});
  description: Nullable<string>;
};

/** Seeded role names. Stored as plain strings so extra roles can be added. */
export const ROLE_NAMES = [
  "ADMIN",
  "BRANCH_MANAGER",
  "HUB_OPERATOR",
  "DISPATCHER",
  "SUPPORT",
  "FINANCE",
  "RIDER",
] as const;

export type KnownRoleName = (typeof ROLE_NAMES)[number];
export type RoleName = KnownRoleName;

export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

/** Staff and riders both authenticate against this table. */
export type User = EntityBase & Timestamped & {
  branchId: Nullable<Id>;
  name: string;
  email: string;
  phone: Nullable<string>;
  passwordHash: string;
  status: UserStatus;
};

export type UserRole = {
  userId: Id;
  roleId: Id;
};

export type RolePermission = {
  roleId: Id;
  permissionKey: string;
};

/** Hub scoping for staff who are not branch-wide (e.g. `HUB_OPERATOR`). */
export type UserHub = {
  userId: Id;
  hubId: Id;
};

export type UserWithRoles = User & {
  roles: Role[];
  permissions: string[];
  /** Populated from `user_hubs` for hub-scoped staff. */
  hubIds: Id[];
};
