import type { Connection, Pool, RowDataPacket } from "mysql2/promise"
import type { Context } from "hono"

import { DomainError, ERROR_CODES, fromDatabaseError, notFound } from "../../core"
import { buildPage, normalizeListParams, type Page } from "../../db/models"
import { withTransaction } from "../../db/transaction"
import { ALL_PERMISSION_KEYS, PERMISSIONS, type PermissionKey } from "../../shared/auth/permissions"
import type { AppEnv } from "../../types/env"

import type {
  CreateRoleInput,
  ListRolesQuery,
  ReplacePermissionsInput,
  RoleDetailResponse,
  RoleResponse,
} from "./roles.dto"
import {
  countActiveHoldersExcludingRole,
  insertRole,
  replaceRolePermissions as replaceRolePermissionRows,
  selectRole,
  selectRolePermissions,
  selectRoles,
} from "./roles.repository"

/**
 * The role list — Batch 1's slice of the RBAC surface. It exists here so the
 * user form's role picker reads roles through the same policy-gated operation
 * the permission matrix builds on, instead of through a one-off reference
 * endpoint that would then have to be retired.
 */
export async function listRoles(
  c: Context<AppEnv>,
  query: ListRolesQuery,
): Promise<Page<RoleResponse>> {
  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectRoles(c.get("db")!, params, {
    search: query.search,
  })
  return buildPage(nodes, totalCount, params)
}

/**
 * The role with every static key and its granted flag, in catalog order. The
 * matrix renders from this one response: a detail read plus a separate grants
 * read would be two requests to stitch together for a sheet that opens once.
 */
export async function getRole(c: Context<AppEnv>, roleId: string): Promise<RoleDetailResponse> {
  const db = c.get("db")!
  const role = await selectRole(db, roleId)
  if (!role) throw notFound("No such role")
  return hydrate(db, role)
}

/**
 * Creates the role empty. Granting keys is `replaceRolePermissions`' job —
 * the name is the only thing this write owns, which is why the response is
 * the plain projection rather than a detail full of `granted: false`.
 */
export async function createRole(
  c: Context<AppEnv>,
  input: CreateRoleInput,
): Promise<RoleResponse> {
  const db = c.get("db")!
  const roleId = await withTransaction(db, async (tx) => {
    const [taken] = await tx.query<RowDataPacket[]>(`SELECT id FROM roles WHERE name = ? LIMIT 1`, [
      input.name,
    ])
    if (taken[0]) {
      throw new DomainError(ERROR_CODES.ALREADY_EXISTS, "A role with that name already exists.")
    }

    try {
      return await insertRole(tx, { name: input.name, description: input.description ?? null })
    } catch (error) {
      throw fromDatabaseError(error, "A role with that name")
    }
  })

  const role = await selectRole(db, roleId)
  /* c8 ignore next -- read straight back from a row the transaction just wrote. */
  if (!role) throw new Error("The role vanished immediately after creation")
  return role
}

/**
 * Puts the whole key set on the role. The lockout guard runs inside the
 * transaction, before the replace, so it cannot race another write out of the
 * same door: if dropping `users.manage` here would leave no ACTIVE account
 * able to reach the screen that can undo this change, the request is
 * well-formed but this database's state will not allow it — a 409, the same
 * code the last-ADMIN guard in `users.service` uses for the same reasoning.
 *
 * The guard fires only when the role *currently* holds the key and no other
 * role reaches it: stripping a role that never granted user management cannot
 * lock anyone out of anything.
 */
export async function replaceRolePermissions(
  c: Context<AppEnv>,
  roleId: string,
  input: ReplacePermissionsInput,
): Promise<RoleDetailResponse> {
  const db = c.get("db")!
  const keys = [...new Set(input.permissionKeys)]

  await withTransaction(db, async (tx) => {
    const role = await selectRole(tx, roleId)
    if (!role) throw notFound("No such role")

    const unknown = keys.filter((key) => !ALL_PERMISSION_KEYS.includes(key as PermissionKey))
    if (unknown.length > 0) {
      throw new DomainError(
        ERROR_CODES.VALIDATION_FAILED,
        "One of those permissions does not exist.",
        {
          details: [
            { field: "permissionKeys", message: `Unknown permission: ${unknown.join(", ")}` },
          ],
        },
      )
    }

    if (!keys.includes(PERMISSIONS.USERS_MANAGE)) {
      const current = await selectRolePermissions(tx, roleId)
      const losingTheKey = current.includes(PERMISSIONS.USERS_MANAGE)
      const noOtherPath =
        (await countActiveHoldersExcludingRole(tx, PERMISSIONS.USERS_MANAGE, roleId)) === 0
      if (losingTheKey && noOtherPath) {
        throw new DomainError(
          ERROR_CODES.INVALID_STATE_TRANSITION,
          "This is the last role granting users.manage. Grant it to another role first.",
        )
      }
    }

    await replaceRolePermissionRows(tx, roleId, keys)
  })

  const role = await selectRole(db, roleId)
  /* c8 ignore next -- the row was replaced in the transaction above. */
  if (!role) throw notFound("No such role")
  return hydrate(db, role)
}

async function hydrate(db: Pool | Connection, role: RoleResponse): Promise<RoleDetailResponse> {
  const granted = new Set(await selectRolePermissions(db, role.id))
  return {
    ...role,
    permissions: ALL_PERMISSION_KEYS.map((key) => ({ key, granted: granted.has(key) })),
  }
}
