import type { Connection, OkPacket, Pool, RowDataPacket } from "mysql2/promise"

import type { ListParams, Transfer, TransferParcel } from "@/db/models"
import type { Scope } from "@/shared/auth/auth-context"
import { escapeLike, orderByClauseOf, pageOf, toStringOrNull, toUtcDate } from "@/db/sql"
import type { Id, ParcelStatus } from "@dropx/types"

const TRANSFER_COLUMNS = `
  t.id, t.transfer_number, t.from_hub_id, t.to_hub_id, t.route_id, t.vehicle_id,
  t.driver_id, t.status, t.departed_at, t.arrived_at, t.created_at, t.updated_at
`

/**
 * A transfer has two ends, and scoping is the interesting question here.
 *
 * A pickup inherits one hub from its parcel; a transfer has two of its own. The
 * scope predicate therefore matches **either** end:
 *
 * - **`AND`** (caller must own both hubs) hides the transfer a hub is about to
 *   unload, because that transfer was raised by somebody else's hub. Dispatch
 *   would not be able to see a truck arriving at them.
 * - **`from_hub` only** hides the same thing from the other side.
 * - **`OR`** over both is what a hub actually needs: it must see the transfers it
 *   is loading *and* the transfers it is about to receive. The cost is that a hub
 *   sees transfers between two other hubs, which is a load rather than a leak —
 *   it can read the manifest but cannot modify a transfer whose origin it is not.
 *
 * Note the asymmetry in the write paths: a **mutation** is checked against
 * `from_hub_id` alone, because the hub that owns the transfer is the one loading
 * it. A hub that can see an inbound transfer can read its manifest and unload it,
 * but cannot edit its route or delete it.
 */
/** Both ends, for the read predicate and for the `hubId` list filter alike. */
const TRANSFER_SCOPE_PREDICATE = "((t.from_hub_id = ?) OR (t.to_hub_id = ?))"

const HUB_COLUMNS =
  "fh.name AS from_hub_name, fh.code AS from_hub_code, th.name AS to_hub_name, th.code AS to_hub_code"

const TRANSFER_FROM = `transfers AS t
  LEFT JOIN hubs AS fh ON fh.id = t.from_hub_id
  LEFT JOIN hubs AS th ON th.id = t.to_hub_id`

/**
 * The read scope as an `EXISTS`, not a join.
 *
 * A `LEFT JOIN hubs AS scope_hub ON scope_hub.id IN (t.from_hub_id, t.to_hub_id)`
 * reads naturally and is wrong: a hub that owns *both* ends matches twice, so the
 * page returns the same transfer twice and `COUNT(*)` doubles as well — which
 * paginates a dispatcher through phantom pages forever. `EXISTS` is a predicate,
 * so it cannot multiply rows no matter how many hubs match.
 */
function readScopeClause(scope: Scope): { text: string; params: unknown[] } | null {
  if (scope.isCompanyWide) return null

  const ends = "(t.from_hub_id, t.to_hub_id)"
  const clauses: string[] = []
  const params: unknown[] = []

  if (scope.branchId) {
    clauses.push(`EXISTS (SELECT 1 FROM hubs AS sh WHERE sh.id IN ${ends} AND sh.branch_id = ?)`)
    params.push(scope.branchId)
  }
  if (scope.hubIds.length > 0) {
    clauses.push(
      `EXISTS (SELECT 1 FROM hubs AS sh WHERE sh.id IN ${ends} AND sh.id IN (${scope.hubIds
        .map(() => "?")
        .join(", ")}))`,
    )
    params.push(...scope.hubIds)
  }
  // Neither a branch nor explicit hubs means unrestricted, not empty: the same
  // interpretation `applyScope` makes for staff with no hub assignment.
  if (clauses.length === 0) return null

  return { text: `(${clauses.join(") AND (")})`, params }
}

/**
 * Client sort key → SQL column expression. An array allowlist holding SQL names
 * would never match the camelCase key a client sends, so `sortBy` would silently
 * do nothing — see the note in `rider-locations.repository.ts`.
 */
const TRANSFER_SORT_COLUMNS = {
  departedAt: "t.departed_at",
  arrivedAt: "t.arrived_at",
  status: "t.status",
  createdAt: "t.created_at",
} as const

const TRANSFER_TIEBREAK = "t.created_at DESC, t.id DESC"
const TRANSFER_SEARCH_COLUMNS = ["t.transfer_number", "fh.name", "th.name", "v.registration_number"]

function transferRow(row: Record<string, unknown>): Transfer {
  return {
    id: String(row.id),
    transferNumber: String(row.transfer_number),
    fromHubId: String(row.from_hub_id),
    toHubId: String(row.to_hub_id),
    routeId: toStringOrNull(row.route_id),
    vehicleId: toStringOrNull(row.vehicle_id),
    driverId: toStringOrNull(row.driver_id),
    status: row.status as Transfer["status"],
    departedAt: nullableDate(row.departed_at),
    arrivedAt: nullableDate(row.arrived_at),
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
  }
}

function nullableDate(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return toUtcDate(value as string | Date).toISOString()
}

export type TransferWithParcels = Transfer & {
  parcels: (TransferParcel & { trackingNumber: string; status: ParcelStatus })[]
  fromHubName: string
  fromHubCode: string
  toHubName: string
  toHubCode: string
  /**
   * `null` until `withParcelCounts` has filled it. The list path sets it; the
   * read path leaves it `null` because it already has the manifest itself.
   */
  parcelCount: number | null
}

/**
 * The write predicate. Kept separate from the read one on purpose — see the scope
 * note at the top of this file — and named for what it is so a reader does not
 * have to reconstruct which one a given query uses.
 */
function writeScopeClause(scope: Scope): { text: string; params: unknown[] } | null {
  if (scope.isCompanyWide) return null
  const clauses: string[] = []
  const params: unknown[] = []

  // `EXISTS` rather than a join, for the same reason the read predicate uses one:
  // an `UPDATE transfers AS t ... AND fh.branch_id = ?` would need the `fh` alias
  // in the statement's FROM, and a multi-table UPDATE changes the locking and the
  // affected-row count. A subquery keeps the statement single-table.
  if (scope.branchId) {
    clauses.push(
      "EXISTS (SELECT 1 FROM hubs AS wh WHERE wh.id = t.from_hub_id AND wh.branch_id = ?)",
    )
    params.push(scope.branchId)
  }
  if (scope.hubIds.length > 0) {
    clauses.push(`t.from_hub_id IN (${scope.hubIds.map(() => "?").join(", ")})`)
    params.push(...scope.hubIds)
  }
  if (clauses.length === 0) return null

  return { text: `(${clauses.join(") AND (")})`, params }
}

export type ListTransfersFilter = {
  status?: Transfer["status"] | undefined
  hubId?: Id | undefined
  vehicleId?: Id | undefined
  driverId?: Id | undefined
  search?: string | undefined
  direction?: "all" | "outgoing" | "incoming" | undefined
}

export async function selectTransfers(
  db: Pool | Connection,
  scope: Scope,
  params: ListParams,
  filter: ListTransfersFilter,
): Promise<{ nodes: TransferWithParcels[]; totalCount: number }> {
  const filterParams: unknown[] = []
  const clauses: string[] = []

  const scopeSql = readScopeClause(scope)
  if (scopeSql) {
    clauses.push(scopeSql.text)
    filterParams.push(...scopeSql.params)
  }

  if (filter.status) {
    clauses.push("t.status = ?")
    filterParams.push(filter.status)
  }
  if (filter.hubId) {
    clauses.push(
      filter.direction === "outgoing"
        ? "t.from_hub_id = ?"
        : filter.direction === "incoming"
          ? "t.to_hub_id = ?"
          : TRANSFER_SCOPE_PREDICATE,
    )
    if (filter.direction === "outgoing" || filter.direction === "incoming") {
      filterParams.push(filter.hubId)
    } else {
      filterParams.push(filter.hubId, filter.hubId)
    }
  }
  if (filter.vehicleId) {
    clauses.push("t.vehicle_id = ?")
    filterParams.push(filter.vehicleId)
  }
  if (filter.driverId) {
    clauses.push("t.driver_id = ?")
    filterParams.push(filter.driverId)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(`(${TRANSFER_SEARCH_COLUMNS.map((c) => `${c} LIKE ?`).join(" OR ")})`)
    for (const _ of TRANSFER_SEARCH_COLUMNS) filterParams.push(like)
  }

  const where = clauses.length ? `WHERE (${clauses.join(") AND (")})` : ""
  const sortColumn = params.sortBy
    ? (TRANSFER_SORT_COLUMNS as Record<string, string>)[params.sortBy]
    : undefined
  const orderBy = orderByClauseOf(sortColumn, params.sort, TRANSFER_TIEBREAK)

  // `vehicles` is joined for the search columns and for nothing else; the
  // registration number is what a dispatcher types, and the row would otherwise
  // have to be looked up by id.
  const from = `${TRANSFER_FROM} LEFT JOIN vehicles AS v ON v.id = t.vehicle_id`

  const page = await pageOf(db, {
    pageSql: `SELECT ${TRANSFER_COLUMNS}, ${HUB_COLUMNS} FROM ${from} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    // The space before `${where}` is load-bearing: `where` is "" for an
    // unfiltered query, and concatenating it directly produced
    // `... t.vehicle_idWHERE ...` the moment any filter existed.
    countSql: `SELECT COUNT(*) AS count FROM ${from} ${where}`,
    filterParams,
    params,
    decode: (row) => withNames(transferRow(row), row),
  })
  return { nodes: await withParcelCounts(db, page.nodes), totalCount: page.totalCount }
}

function withNames(transfer: Transfer, row: Record<string, unknown>): TransferWithParcels {
  return {
    ...transfer,
    parcels: [],
    fromHubName: String(row.from_hub_name ?? ""),
    fromHubCode: String(row.from_hub_code ?? ""),
    toHubName: String(row.to_hub_name ?? ""),
    toHubCode: String(row.to_hub_code ?? ""),
    parcelCount: null,
  }
}

/**
 * The list's manifest is a **count**, not the parcels.
 *
 * A page of 20 transfers each carrying up to 500 manifest rows would be a 10,000-row
 * response for a screen that renders 20 lines, and the count is the only part of it
 * a dispatcher reads while scanning. So the list schema declares `parcelCount` and
 * this function fills it with one grouped subquery over the whole page — not one
 * query per row, and not the individual parcel rows.
 */
function withParcelCounts(
  db: Pool | Connection,
  transfers: TransferWithParcels[],
): Promise<TransferWithParcels[]> {
  const uncounted = transfers.filter((transfer) => transfer.parcelCount === null)
  if (uncounted.length === 0) return Promise.resolve(transfers)

  const placeholders = uncounted.map(() => "?").join(", ")
  return db
    .query<RowDataPacket[]>(
      `SELECT transfer_id, COUNT(*) AS parcel_count
       FROM transfer_parcels
       WHERE transfer_id IN (${placeholders})
       GROUP BY transfer_id`,
      uncounted.map((transfer) => transfer.id),
    )
    .then(([rows]) => {
      const counts = new Map(rows.map((row) => [String(row.transfer_id), Number(row.parcel_count)]))
      return transfers.map((transfer) => ({
        ...transfer,
        parcelCount: counts.get(transfer.id) ?? 0,
      }))
    })
}

/**
 * One transfer with its manifest. Locked on request: the manifest and the status
 * move together, and a service that read the transfer unlocked and then wrote it
 * would leave a window where a departure happened against a manifest that had
 * just been emptied.
 */
export async function selectTransferWithParcels(
  db: Pool | Connection,
  scope: Scope,
  transferId: string,
  options: { forUpdate?: boolean } = {},
): Promise<TransferWithParcels | null> {
  const clauses = ["t.id = ?"]
  const params: unknown[] = [transferId]
  const scopeSql = readScopeClause(scope)
  if (scopeSql) {
    clauses.push(scopeSql.text)
    params.push(...scopeSql.params)
  }

  const transfer = await db.query<RowDataPacket[]>(
    `SELECT ${TRANSFER_COLUMNS}, ${HUB_COLUMNS} FROM ${TRANSFER_FROM}
     WHERE ${clauses.join(" AND ")} LIMIT 1${options.forUpdate ? " FOR UPDATE" : ""}`,
    params,
  )
  const row = transfer[0][0]
  if (!row) return null

  const parcels = await selectTransferParcels(db, String(row.id))
  return { ...withNames(transferRow(row), row), parcels }
}

export async function selectTransferParcels(
  db: Pool | Connection,
  transferId: string,
): Promise<(TransferParcel & { trackingNumber: string; status: ParcelStatus })[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT tp.parcel_id, tp.loaded_at, tp.unloaded_at, p.tracking_number, p.status
     FROM transfer_parcels AS tp
     JOIN parcels AS p ON p.id = tp.parcel_id
     WHERE tp.transfer_id = ?
     ORDER BY p.tracking_number`,
    [transferId],
  )
  return rows.map((row) => ({
    transferId,
    parcelId: String(row.parcel_id),
    trackingNumber: String(row.tracking_number),
    status: row.status as ParcelStatus,
    loadedAt: nullableDate(row.loaded_at),
    unloadedAt: nullableDate(row.unloaded_at),
  }))
}

/**
 * Resolves a `driverRef` to a staff user id.
 *
 * Matches either the `users` id or the email, and requires the account to be
 * ACTIVE: a suspended driver on the manifest is worse than no driver, because the
 * screen would show a transfer that nobody can actually perform.
 */
export async function findStaffByRef(db: Pool | Connection, ref: string): Promise<string | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id FROM users WHERE (id = ? OR email = ?) AND status = 'ACTIVE' LIMIT 1`,
    [ref, ref],
  )
  return rows[0] ? String(rows[0].id) : null
}

export async function findHub(db: Pool | Connection, hubId: string): Promise<boolean> {
  const [rows] = await db.query<RowDataPacket[]>(`SELECT id FROM hubs WHERE id = ? LIMIT 1`, [
    hubId,
  ])
  return rows.length > 0
}

export async function findVehicle(db: Pool | Connection, vehicleId: string): Promise<boolean> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id FROM vehicles WHERE id = ? AND status = 'ACTIVE' LIMIT 1`,
    [vehicleId],
  )
  return rows.length > 0
}

export async function findRoute(db: Pool | Connection, routeId: string): Promise<boolean> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id FROM routes WHERE id = ? AND status = 'ACTIVE' LIMIT 1`,
    [routeId],
  )
  return rows.length > 0
}

/** `TRF` + `YYMMDD` + 6 digits, mirroring the parcel tracking number. */
export function generateTransferNumber(now = new Date()): string {
  const y = String(now.getUTCFullYear()).slice(2)
  const m = String(now.getUTCMonth() + 1).padStart(2, "0")
  const d = String(now.getUTCDate()).padStart(2, "0")
  return `TRF${y}${m}${d}${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`
}

export async function insertTransfer(
  db: Pool | Connection,
  record: {
    transferNumber: string
    fromHubId: Id
    toHubId: Id
    routeId: string | null
    vehicleId: string | null
    driverId: string | null
    status: Transfer["status"]
  },
): Promise<string> {
  const [result] = await db.execute<OkPacket>(
    `INSERT INTO transfers (transfer_number, from_hub_id, to_hub_id, route_id, vehicle_id, driver_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      record.transferNumber,
      record.fromHubId,
      record.toHubId,
      record.routeId,
      record.vehicleId,
      record.driverId,
      record.status,
    ],
  )
  if (!result.insertId) throw new Error("Transfer insert returned no id")
  return String(result.insertId)
}

export async function updateTransferRow(
  db: Pool | Connection,
  scope: Scope,
  transferId: string,
  patch: {
    fromHubId?: string | undefined
    toHubId?: string | undefined
    routeId?: string | null | undefined
    vehicleId?: string | null | undefined
    driverId?: string | null | undefined
  },
): Promise<number> {
  const assignments: string[] = []
  const params: (string | null)[] = []

  if (patch.fromHubId !== undefined) {
    assignments.push("from_hub_id = ?")
    params.push(patch.fromHubId)
  }
  if (patch.toHubId !== undefined) {
    assignments.push("to_hub_id = ?")
    params.push(patch.toHubId)
  }
  if (patch.routeId !== undefined) {
    assignments.push("route_id = ?")
    params.push(patch.routeId)
  }
  if (patch.vehicleId !== undefined) {
    assignments.push("vehicle_id = ?")
    params.push(patch.vehicleId)
  }
  if (patch.driverId !== undefined) {
    assignments.push("driver_id = ?")
    params.push(patch.driverId)
  }

  if (assignments.length === 0) return 0

  params.push(transferId)
  let sql = `UPDATE transfers AS t SET ${assignments.join(", ")} WHERE t.id = ?`

  const scoped = writeScopeClause(scope)
  if (scoped) {
    sql += ` AND ${scoped.text}`
    params.push(...(scoped.params as (string | null)[]))
  }

  const [result] = await db.execute<OkPacket>(sql, params)
  return result.affectedRows
}

/**
 * The status write, with the two timestamps that belong to a specific status
 * stamped by the database rather than by the caller.
 *
 * `departed_at` and `arrived_at` are not nullable in the caller's intent: they
 * exist to answer "when did it leave" and "when did it get here", and a status
 * change that skipped them would leave the transfer permanently unanswerable.
 */
export async function updateTransferStatusRow(
  db: Pool | Connection,
  scope: Scope,
  transferId: string,
  status: Transfer["status"],
): Promise<number> {
  const assignments = ["t.status = ?"]
  const params: (string | null)[] = [status]

  if (status === "IN_TRANSIT") assignments.push("t.departed_at = NOW()")
  if (status === "ARRIVED") assignments.push("t.arrived_at = NOW()")

  params.push(transferId)
  let sql = `UPDATE transfers AS t SET ${assignments.join(", ")} WHERE t.id = ?`

  const scoped = writeScopeClause(scope)
  if (scoped) {
    sql += ` AND ${scoped.text}`
    params.push(...(scoped.params as (string | null)[]))
  }

  const [result] = await db.execute<OkPacket>(sql, params)
  return result.affectedRows
}

export async function deleteTransferRow(
  db: Pool | Connection,
  scope: Scope,
  transferId: string,
): Promise<number> {
  const params: (string | null)[] = [transferId]
  let sql = `DELETE FROM transfers AS t WHERE t.id = ?`

  const scoped = writeScopeClause(scope)
  if (scoped) {
    sql += ` AND ${scoped.text}`
    params.push(...(scoped.params as (string | null)[]))
  }

  const [result] = await db.execute<OkPacket>(sql, params)
  return result.affectedRows
}

/**
 * Replaces the manifest wholesale.
 *
 * Delete-then-insert rather than a diff, inside a transaction the caller owns, so
 * a caller either sees the old manifest or the new one and never a half-applied
 * one. The delete is scoped to this transfer by the join, not by a second read.
 *
 * `loaded_at` and `unloaded_at` are **not** set here — they record the truck
 * leaving and arriving, which is the status path's job. A manifest row stamped on
 * entry would claim a parcel was loaded at the moment somebody typed a list.
 */
export async function replaceTransferManifest(
  db: Pool | Connection,
  transferId: string,
  parcelIds: readonly string[],
): Promise<void> {
  await db.execute(`DELETE FROM transfer_parcels WHERE transfer_id = ?`, [transferId])
  if (parcelIds.length === 0) return

  const values = parcelIds.map(() => "(?, ?)").join(", ")
  const params: string[] = [transferId]
  for (const parcelId of parcelIds) params.push(parcelId)
  await db.execute(`INSERT INTO transfer_parcels (transfer_id, parcel_id) VALUES ${values}`, params)
}

/**
 * Loads every manifest row: the truck is leaving now, so every parcel on it is
 * loaded. One statement, because a loop of updates would be N round trips and
 * would still not be atomic.
 */
export async function stampManifestLoaded(
  db: Pool | Connection,
  transferId: string,
): Promise<string[]> {
  const [result] = await db.execute<OkPacket>(
    `UPDATE transfer_parcels SET loaded_at = NOW() WHERE transfer_id = ? AND loaded_at IS NULL`,
    [transferId],
  )
  if (result.affectedRows === 0) return []
  return selectManifestParcelIds(db, transferId)
}

export async function stampManifestUnloaded(
  db: Pool | Connection,
  transferId: string,
): Promise<string[]> {
  const [result] = await db.execute<OkPacket>(
    `UPDATE transfer_parcels SET unloaded_at = NOW() WHERE transfer_id = ? AND unloaded_at IS NULL`,
    [transferId],
  )
  if (result.affectedRows === 0) return []
  return selectManifestParcelIds(db, transferId)
}

export async function selectManifestParcelIds(
  db: Pool | Connection,
  transferId: string,
): Promise<string[]> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT parcel_id FROM transfer_parcels WHERE transfer_id = ? ORDER BY parcel_id`,
    [transferId],
  )
  return rows.map((row) => String(row.parcel_id))
}

export async function countManifest(db: Pool | Connection, transferId: string): Promise<number> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM transfer_parcels WHERE transfer_id = ?`,
    [transferId],
  )
  return Number(rows[0]?.count ?? 0)
}

/**
 * The parcels a manifest *may* contain, for one origin hub.
 *
 * Returned rather than filtered inside the insert so the service can name the
 * offending parcel in a 422 instead of silently dropping it: "TRF-… cannot carry
 * DX-… because it is not at the origin hub" is an answer a dispatcher can act on,
 * whereas a manifest quietly missing three parcels is a discrepancy found at the
 * other end.
 */
export async function findManifestCandidates(
  db: Pool | Connection,
  hubId: string,
  parcelIds: readonly string[],
): Promise<Map<string, { status: ParcelStatus } | null>> {
  const found = new Map<string, { status: ParcelStatus } | null>()
  for (const parcelId of parcelIds) found.set(parcelId, null)
  if (parcelIds.length === 0) return found

  const placeholders = parcelIds.map(() => "?").join(", ")
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT id, status FROM parcels WHERE current_hub_id = ? AND id IN (${placeholders})
     FOR UPDATE`,
    [hubId, ...parcelIds],
  )
  for (const row of rows) found.set(String(row.id), { status: row.status as ParcelStatus })
  return found
}

/** Every parcel on a manifest, for the bulk status move on departure and arrival. */
export async function moveParcelsToStatus(
  db: Pool | Connection,
  parcelIds: readonly string[],
  status: ParcelStatus,
): Promise<void> {
  if (parcelIds.length === 0) return
  const placeholders = parcelIds.map(() => "?").join(", ")
  await db.execute(`UPDATE parcels SET status = ? WHERE id IN (${placeholders})`, [
    status,
    ...parcelIds,
  ])
}

export async function moveParcelsToHub(
  db: Pool | Connection,
  parcelIds: readonly string[],
  hubId: string,
): Promise<void> {
  if (parcelIds.length === 0) return
  const placeholders = parcelIds.map(() => "?").join(", ")
  await db.execute(`UPDATE parcels SET current_hub_id = ? WHERE id IN (${placeholders})`, [
    hubId,
    ...parcelIds,
  ])
}
