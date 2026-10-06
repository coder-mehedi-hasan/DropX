import bcrypt from "bcryptjs"

import type { Connection, Pool, RowDataPacket } from "mysql2/promise"

import { DomainError, ERROR_CODES, fromDatabaseError, notFound } from "../../core"
import type { Context } from "hono"
import type { UserStatus } from "../../db/models"
import { buildPage, normalizeListParams, TABLES, type Page } from "../../db/models"
import { withTransaction } from "../../db/transaction"
import type { Scope } from "../../shared/auth/auth-context"
import type { AppEnv } from "../../types/env"

import type {
  CreateUserInput,
  ListUsersQuery,
  ResetPasswordInput,
  UpdateUserInput,
  UserResponse,
} from "./users.dto"

import {
  countActiveAdminsExcluding,
  insertUser,
  patchUser,
  replaceUserHubs,
  replaceUserRoles,
  selectExistingIds,
  selectRoleIdsForUser,
  selectRoleIdByName,
  selectUser,
  selectUserHubs,
  selectUserRoles,
  selectUsers,
  updatePasswordHash,
  type StaffUserRecord,
} from "./users.repository"

/**
 * Read-back scope for a row the caller just wrote. The write already proved
 * the caller may touch it (`users.manage`, and the row was found in scope), so
 * re-applying the scope would only turn a successful create into a 404 when the
 * new account's own shape falls outside the writer's filter.
 */
const WRITE_READBACK: Scope = { userId: "", branchId: null, hubIds: [], isCompanyWide: true }

const ADMIN_ROLE = "ADMIN"

export async function listUsers(
  c: Context<AppEnv>,
  scope: Scope,
  query: ListUsersQuery,
): Promise<Page<UserResponse>> {
  const db = c.get("db")!
  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectUsers(db, scope, params, {
    status: query.status,
    branchId: query.branchId,
    search: query.search,
  })
  return buildPage(await hydrateMany(db, nodes), totalCount, params)
}

export async function getUser(
  c: Context<AppEnv>,
  scope: Scope,
  userId: string,
): Promise<UserResponse> {
  const db = c.get("db")!
  const user = await selectUser(db, scope, userId)
  if (!user) throw notFound("No such user")
  return hydrate(db, user)
}

/**
 * Creates the account and both assignment sets in one transaction: a `users`
 * row with no roles is an account that cannot do anything, and role rows with
 * no account are rows nothing can sign in as. Neither half is useful alone, so
 * neither is ever written alone.
 *
 * The password is hashed outside the transaction — bcrypt is deliberately
 * slow, and holding a pooled connection across it is how pools starve.
 */
export async function createUser(
  c: Context<AppEnv>,
  input: CreateUserInput,
): Promise<UserResponse> {
  const db = c.get("db")!
  const passwordHash = await bcrypt.hash(input.password, 10)
  const branchId = input.branchId ?? null

  const userId = await withTransaction(db, async (tx) => {
    const [taken] = await tx.query<RowDataPacket[]>(
      `SELECT id FROM ${TABLES.users} WHERE email = ? LIMIT 1`,
      [input.email],
    )
    if (taken[0]) {
      throw new DomainError(
        ERROR_CODES.ALREADY_EXISTS,
        "An account with that email already exists.",
      )
    }

    await assertAssignmentsExist(tx, {
      roleIds: input.roleIds,
      hubIds: input.hubIds,
      branchId,
    })

    let newUserId: string
    try {
      newUserId = await insertUser(tx, {
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        passwordHash,
        status: input.status,
        branchId,
      })
    } catch (error) {
      throw fromDatabaseError(error, "An account with that email already exists")
    }

    await replaceUserRoles(tx, newUserId, input.roleIds)
    await replaceUserHubs(tx, newUserId, input.hubIds)
    return newUserId
  })

  const user = await selectUser(db, WRITE_READBACK, userId)
  /* c8 ignore next -- read straight back from a row the transaction just wrote. */
  if (!user) throw new Error("The user vanished immediately after creation")
  return hydrate(db, user)
}

/**
 * `email` and `password` are unreachable here (see `updateUserSchema`), so the
 * only writes are the profile columns and — when supplied — a full replacement
 * of both assignment sets. The last-admin guard runs inside the transaction so
 * it cannot race another update out of the same door.
 *
 * `branchId: null` clears the restriction; a key that is absent leaves it
 * alone. That distinction is the whole reason the field is `nullish` and the
 * patch is partial.
 */
export async function updateUser(
  c: Context<AppEnv>,
  scope: Scope,
  userId: string,
  patch: UpdateUserInput,
): Promise<UserResponse> {
  const db = c.get("db")!
  const existing = await selectUser(db, scope, userId)
  if (!existing) throw notFound("No such user")

  const branchId = patch.branchId === undefined ? undefined : (patch.branchId ?? null)

  await withTransaction(db, async (tx) => {
    await assertAssignmentsExist(tx, {
      roleIds: patch.roleIds,
      hubIds: patch.hubIds,
      branchId,
    })
    await assertAdminSurvives(tx, existing, patch)

    await patchUser(tx, userId, {
      name: patch.name,
      phone: patch.phone,
      status: patch.status,
      branchId,
    })
    if (patch.roleIds) await replaceUserRoles(tx, userId, patch.roleIds)
    if (patch.hubIds) await replaceUserHubs(tx, userId, patch.hubIds)
  })

  const user = await selectUser(db, WRITE_READBACK, userId)
  /* c8 ignore next -- the row was patched in the transaction above. */
  if (!user) throw notFound("No such user")
  return hydrate(db, user)
}

/**
 * Availability, mirroring `admin.riders.setStatus`: the one account state ops
 * flips from a list row, with the guard that makes it safe to flip.
 */
export async function setUserStatus(
  c: Context<AppEnv>,
  scope: Scope,
  userId: string,
  status: UserStatus,
): Promise<UserResponse> {
  const db = c.get("db")!
  const existing = await selectUser(db, scope, userId)
  if (!existing) throw notFound("No such user")

  await withTransaction(db, async (tx) => {
    await assertAdminSurvives(tx, existing, { status })
    await patchUser(tx, userId, { status })
  })

  const user = await selectUser(db, WRITE_READBACK, userId)
  /* c8 ignore next -- the row was patched in the transaction above. */
  if (!user) throw notFound("No such user")
  return hydrate(db, user)
}

/**
 * The reset is a whole operation rather than a PATCH field: it is the only
 * write that cannot be safely retried from a stale screen, and it always flips
 * `must_change_password` in the same statement (see `updatePasswordHash`).
 *
 * The flag is set even though no staff screen gates on it yet — the rider app
 * does, and an account whose password someone else set should be treated as
 * holding a password that is not its own the moment the admin portal grows its
 * change-password gate.
 */
export async function resetPassword(
  c: Context<AppEnv>,
  scope: Scope,
  userId: string,
  input: ResetPasswordInput,
): Promise<UserResponse> {
  const db = c.get("db")!
  const existing = await selectUser(db, scope, userId)
  if (!existing) throw notFound("No such user")

  const passwordHash = await bcrypt.hash(input.password, 10)
  await updatePasswordHash(db, userId, passwordHash)

  const user = await selectUser(db, WRITE_READBACK, userId)
  /* c8 ignore next -- the row was updated by the statement above. */
  if (!user) throw notFound("No such user")
  return hydrate(db, user)
}

/**
 * The last ACTIVE ADMIN cannot be locked out by either write path — suspending
 * the account or stripping the role have the same result, so both ask the same
 * question. `INVALID_STATE_TRANSITION` is deliberate: 409 reads as "the request
 * is well-formed but this account's state will not allow it", which is exactly
 * what this is, and it is the code the status vocabulary already uses.
 */
async function assertAdminSurvives(
  db: Pool | Connection,
  user: StaffUserRecord,
  next: { status?: UserStatus | undefined; roleIds?: string[] | undefined },
): Promise<void> {
  if (user.status !== "ACTIVE") return

  const adminRoleId = await selectRoleIdByName(db, ADMIN_ROLE)
  if (!adminRoleId) return
  const currentRoleIds = await selectRoleIdsForUser(db, user.id)
  if (!currentRoleIds.includes(adminRoleId)) return

  const nextStatus = next.status ?? user.status
  const nextRoleIds = next.roleIds ?? currentRoleIds
  // Still an active administrator after this write — nothing to protect.
  if (nextStatus === "ACTIVE" && nextRoleIds.includes(adminRoleId)) return

  if ((await countActiveAdminsExcluding(db, user.id)) === 0) {
    throw new DomainError(
      ERROR_CODES.INVALID_STATE_TRANSITION,
      "This is the last active ADMIN account. Promote another administrator first.",
    )
  }
}

/**
 * Every id the request names must exist, checked before anything is written so
 * a bad id is a 422 that names the field rather than a driver error the client
 * cannot map. The FKs would catch it too — but as "a referenced record does not
 * exist" with no hint of which reference.
 */
async function assertAssignmentsExist(
  db: Pool | Connection,
  input: {
    roleIds?: string[] | undefined
    hubIds?: string[] | undefined
    branchId?: string | null | undefined
  },
): Promise<void> {
  if (input.roleIds) {
    const found = await selectExistingIds(db, "roles", input.roleIds)
    if (found.size !== new Set(input.roleIds).size) {
      throw new DomainError(ERROR_CODES.VALIDATION_FAILED, "One of those roles does not exist.", {
        details: [{ field: "roleIds", message: "Pick roles from the list" }],
      })
    }
  }
  if (input.hubIds) {
    const found = await selectExistingIds(db, "hubs", input.hubIds)
    if (found.size !== new Set(input.hubIds).size) {
      throw new DomainError(ERROR_CODES.VALIDATION_FAILED, "One of those hubs does not exist.", {
        details: [{ field: "hubIds", message: "Pick hubs from the list" }],
      })
    }
  }
  if (input.branchId) {
    const found = await selectExistingIds(db, "branches", [input.branchId])
    if (found.size === 0) {
      throw new DomainError(ERROR_CODES.VALIDATION_FAILED, "That branch does not exist.", {
        details: [{ field: "branchId", message: "Pick an existing branch" }],
      })
    }
  }
}

async function hydrate(db: Pool | Connection, user: StaffUserRecord): Promise<UserResponse> {
  const [roles, hubs] = await Promise.all([
    selectUserRoles(db, [user.id]),
    selectUserHubs(db, [user.id]),
  ])
  return {
    ...user,
    roles: roles.map((row) => ({ id: row.roleId, name: row.roleName })),
    hubs: hubs.map((row) => ({ id: row.hubId, name: row.hubName })),
  }
}

/** Role and hub membership for a whole page in two queries, not 2N. */
async function hydrateMany(
  db: Pool | Connection,
  users: StaffUserRecord[],
): Promise<UserResponse[]> {
  const ids = users.map((user) => user.id)
  const [roles, hubs] = await Promise.all([selectUserRoles(db, ids), selectUserHubs(db, ids)])

  const rolesByUser = new Map<string, { id: string; name: string }[]>()
  for (const row of roles) {
    const list = rolesByUser.get(row.userId) ?? []
    list.push({ id: row.roleId, name: row.roleName })
    rolesByUser.set(row.userId, list)
  }
  const hubsByUser = new Map<string, { id: string; name: string }[]>()
  for (const row of hubs) {
    const list = hubsByUser.get(row.userId) ?? []
    list.push({ id: row.hubId, name: row.hubName })
    hubsByUser.set(row.userId, list)
  }

  return users.map((user) => ({
    ...user,
    roles: rolesByUser.get(user.id) ?? [],
    hubs: hubsByUser.get(user.id) ?? [],
  }))
}
