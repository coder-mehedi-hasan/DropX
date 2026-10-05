import type { Connection, OkPacket, Pool, RowDataPacket } from "mysql2/promise"

import type { DeliveryProof, ListParams } from "@/db/models"
import type { Scope } from "@/shared/auth/auth-context"
import {
  escapeLike,
  orderByClauseOf,
  pageOf,
  toStringOrNull,
  toUtcDate,
  whereClause,
} from "@/db/sql"
import type { Id } from "@dropx/types"

import { applyScope } from "../parcels/parcels.repository"

const PROOF_COLUMNS = `
  dp.id, dp.delivery_id, dp.type, dp.value, dp.file_url, dp.verified_at, dp.created_at,
  p.tracking_number AS parcel_tracking_number,
  d.attempt_no,
  u.name AS rider_name, r.employee_code AS rider_employee_code,
  h.name AS hub_name
`

/**
 * A proof belongs to a delivery attempt, which belongs to a hub — the same
 * hub the attempt is scoped on. So scope resolves through `d.hub_id`, the
 * join chain `delivery_proofs → deliveries → hubs`, using the same `scope_hub`
 * alias `applyScope` writes against.
 */
const PROOF_FROM = `delivery_proofs AS dp
  JOIN deliveries AS d ON d.id = dp.delivery_id
  JOIN parcels AS p ON p.id = d.parcel_id
  LEFT JOIN riders AS r ON r.id = d.rider_id
  LEFT JOIN users AS u ON u.id = r.user_id
  LEFT JOIN hubs AS h ON h.id = d.hub_id
  LEFT JOIN hubs AS scope_hub ON scope_hub.id = d.hub_id`

const PROOF_SORT_COLUMNS = {
  createdAt: "dp.created_at",
  type: "dp.type",
} as const

const PROOF_TIEBREAK = "dp.created_at DESC, dp.id DESC"
const PROOF_SEARCH_COLUMNS = ["p.tracking_number", "u.name", "r.employee_code", "h.name"]

export type DeliveryProofRow = DeliveryProof & {
  parcelTrackingNumber: string
  attemptNo: number
  riderName: string
  riderEmployeeCode: string
  hubName: string
}

function proofRow(row: Record<string, unknown>): DeliveryProofRow {
  return {
    id: String(row.id),
    deliveryId: String(row.delivery_id),
    type: row.type as DeliveryProof["type"],
    value: toStringOrNull(row.value),
    fileUrl: toStringOrNull(row.file_url),
    verifiedAt: nullableDate(row.verified_at),
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    parcelTrackingNumber: String(row.parcel_tracking_number),
    attemptNo: Number(row.attempt_no),
    riderName: String(row.rider_name),
    riderEmployeeCode: String(row.rider_employee_code),
    hubName: String(row.hub_name),
  }
}

function nullableDate(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return toUtcDate(value as string | Date).toISOString()
}

export type ListDeliveryProofsFilter = {
  type?: DeliveryProof["type"] | undefined
  verified?: "true" | "false" | undefined
  deliveryId?: Id | undefined
  search?: string | undefined
}

function scopePredicate(scope: Scope): { text: string; params: unknown[] } | null {
  const clause = applyScope(scope)
  return clause.params.length > 0 ? clause : null
}

export async function selectDeliveryProofs(
  db: Pool | Connection,
  scope: Scope,
  params: ListParams,
  filter: ListDeliveryProofsFilter,
): Promise<{ nodes: DeliveryProofRow[]; totalCount: number }> {
  const filterParams: unknown[] = []
  const clauses: string[] = []

  const scopeSql = scopePredicate(scope)
  if (scopeSql) {
    clauses.push(scopeSql.text)
    filterParams.push(...scopeSql.params)
  }

  if (filter.type) {
    clauses.push("dp.type = ?")
    filterParams.push(filter.type)
  }
  if (filter.verified === "true") {
    clauses.push("dp.verified_at IS NOT NULL")
  }
  if (filter.verified === "false") {
    clauses.push("dp.verified_at IS NULL")
  }
  if (filter.deliveryId) {
    clauses.push("dp.delivery_id = ?")
    filterParams.push(filter.deliveryId)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(`(${PROOF_SEARCH_COLUMNS.join(" LIKE ? OR ")} LIKE ?)`)
    for (const _ of PROOF_SEARCH_COLUMNS) filterParams.push(like)
  }

  const where = whereClause(clauses)
  const sortColumn = params.sortBy
    ? (PROOF_SORT_COLUMNS as Record<string, string>)[params.sortBy]
    : undefined
  const orderBy = orderByClauseOf(sortColumn, params.sort, PROOF_TIEBREAK)

  return pageOf(db, {
    pageSql: `SELECT ${PROOF_COLUMNS} FROM ${PROOF_FROM} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    countSql: `SELECT COUNT(*) AS count FROM ${PROOF_FROM}${where ? " " + where : ""}`,
    filterParams,
    params,
    decode: proofRow,
  })
}

export async function selectDeliveryProof(
  db: Pool | Connection,
  scope: Scope,
  proofId: string,
  options: { forUpdate?: boolean } = {},
): Promise<DeliveryProofRow | null> {
  const clauses = ["dp.id = ?"]
  const params: unknown[] = [proofId]
  const scoped = scopePredicate(scope)
  if (scoped) {
    clauses.push(scoped.text)
    params.push(...scoped.params)
  }

  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${PROOF_COLUMNS} FROM ${PROOF_FROM} WHERE ${clauses.join(" AND ")} LIMIT 1${
      options.forUpdate ? " FOR UPDATE" : ""
    }`,
    params,
  )
  return rows[0] ? proofRow(rows[0]) : null
}

/** A freshly inserted row read back without a scope — the insert already established ownership. */
export async function selectDeliveryProofById(
  db: Pool | Connection,
  proofId: string,
): Promise<DeliveryProofRow | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${PROOF_COLUMNS} FROM ${PROOF_FROM} WHERE dp.id = ? LIMIT 1`,
    [proofId],
  )
  return rows[0] ? proofRow(rows[0]) : null
}

export async function insertDeliveryProof(
  db: Pool | Connection,
  record: {
    deliveryId: Id
    type: DeliveryProof["type"]
    value: string | null
    fileUrl: string | null
  },
): Promise<string> {
  const sql = `INSERT INTO delivery_proofs (delivery_id, type, value, file_url) VALUES (?, ?, ?, ?)`
  const [result] = await db.execute<OkPacket>(sql, [
    record.deliveryId,
    record.type,
    record.value,
    record.fileUrl,
  ])
  if (!result.insertId) throw new Error("Proof insert returned no id")
  return String(result.insertId)
}

/**
 * Stamps the proof verified. `WHERE dp.verified_at IS NULL` rides along on
 * the write so a double-verify cannot silently overwrite the original
 * timestamp — two concurrent verifies would each 0-row the other.
 */
export async function verifyDeliveryProofRow(
  db: Pool | Connection,
  scope: Scope,
  proofId: string,
): Promise<number> {
  const params: (string | number | null)[] = [proofId]
  let sql = `UPDATE delivery_proofs AS dp
    JOIN deliveries AS d ON d.id = dp.delivery_id
    LEFT JOIN hubs AS scope_hub ON scope_hub.id = d.hub_id
    SET dp.verified_at = NOW()
    WHERE dp.id = ? AND dp.verified_at IS NULL`
  const scoped = scopePredicate(scope)
  if (scoped) {
    sql += ` AND ${scoped.text}`
    params.push(...(scoped.params as (string | number | null)[]))
  }
  const [result] = await db.execute<OkPacket>(sql, params)
  return result.affectedRows
}

/**
 * The rider's own attempts for one parcel, most recent first — the attempt a
 * proof attaches to, newest wins.
 */
export async function selectProofsForParcelAndRider(
  db: Pool | Connection,
  riderId: string,
  parcelId: string,
): Promise<DeliveryProofRow[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${PROOF_COLUMNS}
       FROM ${PROOF_FROM}
      WHERE d.rider_id = ? AND p.id = ?
      ORDER BY dp.created_at DESC, dp.id DESC`,
    [riderId, parcelId],
  )
  return rows.map((row) => proofRow(row))
}

/**
 * The latest attempt the rider may attach a proof to: one that is out for
 * delivery or already delivered. An `ASSIGNED` attempt has not started, so a
 * proof recorded against it is a contradiction, and a closed-failed/returned
 * attempt has already been decided by an outcome with a reason instead.
 */
export async function selectAttemptForProof(
  db: Pool | Connection,
  riderId: string,
  parcelId: string,
): Promise<{ deliveryId: string; status: string } | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT d.id, d.status
       FROM deliveries AS d
      WHERE d.rider_id = ? AND d.parcel_id = ?
        AND d.status IN ('OUT_FOR_DELIVERY', 'DELIVERED')
      ORDER BY d.attempt_no DESC
      LIMIT 1`,
    [riderId, parcelId],
  )
  return rows[0] ? { deliveryId: String(rows[0].id), status: String(rows[0].status) } : null
}
