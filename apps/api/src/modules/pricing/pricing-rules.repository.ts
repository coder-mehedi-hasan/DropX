import type { OkPacket, Pool, RowDataPacket } from "mysql2/promise"

import type { ListParams, PricingRule } from "@/db/models"
import {
  escapeLike,
  orderByClauseOf,
  pageOf,
  sortColumnOf,
  toNullableDecimal,
  toUtcDate,
  whereClause,
} from "@/db/sql"
import { buildAssignments } from "@/db/updates"

const PRICING_RULE_COLUMNS = `
  p.id, p.name, p.origin_zone_id, p.destination_zone_id, p.min_weight, p.max_weight,
  p.base_price, p.price_per_kg, p.cod_percentage, p.cod_fixed_fee, p.express_fee,
  p.status, p.created_at, p.updated_at
`

const PRICING_RULE_SORT_COLUMNS = [
  "p.name",
  "p.origin_zone_id",
  "p.destination_zone_id",
  "p.min_weight",
  "p.created_at",
] as const
const PRICING_RULE_TIEBREAK = "p.created_at DESC, p.id DESC"
const PRICING_RULE_SEARCH_COLUMNS = ["p.name"]

const PRICING_RULE_PATCH_COLUMNS = {
  name: "name",
  originZoneId: "origin_zone_id",
  destinationZoneId: "destination_zone_id",
  minWeight: "min_weight",
  maxWeight: "max_weight",
  basePrice: "base_price",
  pricePerKg: "price_per_kg",
  codPercentage: "cod_percentage",
  codFixedFee: "cod_fixed_fee",
  expressFee: "express_fee",
  status: "status",
} as const

function pricingRuleRow(row: Record<string, unknown>): PricingRule {
  return {
    id: String(row.id),
    name: String(row.name),
    originZoneId: String(row.origin_zone_id),
    destinationZoneId: String(row.destination_zone_id),
    minWeight: Number(row.min_weight),
    maxWeight: toNullableDecimal(row.max_weight),
    basePrice: Number(row.base_price),
    pricePerKg: Number(row.price_per_kg),
    codPercentage: Number(row.cod_percentage),
    codFixedFee: Number(row.cod_fixed_fee),
    expressFee: Number(row.express_fee),
    status: row.status as PricingRule["status"],
    createdAt: toUtcDate(row.created_at as string | Date).toISOString(),
    updatedAt: toUtcDate(row.updated_at as string | Date).toISOString(),
  }
}

export type ListPricingRulesFilter = {
  status?: PricingRule["status"] | undefined
  search?: string | undefined
  originZoneId?: string | undefined
  destinationZoneId?: string | undefined
}

export async function selectPricingRules(
  db: Pool,
  params: ListParams,
  filter: ListPricingRulesFilter,
): Promise<{ nodes: PricingRule[]; totalCount: number }> {
  const filterParams: unknown[] = []
  const clauses: string[] = []

  if (filter.status) {
    clauses.push("p.status = ?")
    filterParams.push(filter.status)
  }
  if (filter.originZoneId) {
    clauses.push("p.origin_zone_id = ?")
    filterParams.push(filter.originZoneId)
  }
  if (filter.destinationZoneId) {
    clauses.push("p.destination_zone_id = ?")
    filterParams.push(filter.destinationZoneId)
  }
  if (filter.search) {
    const like = `%${escapeLike(filter.search)}%`
    clauses.push(`(${PRICING_RULE_SEARCH_COLUMNS.map((c) => `${c} LIKE ?`).join(" OR ")})`)
    for (const _ of PRICING_RULE_SEARCH_COLUMNS) filterParams.push(like)
  }
  const where = whereClause(clauses)
  const orderBy = orderByClauseOf(
    sortColumnOf(params, PRICING_RULE_SORT_COLUMNS),
    params.sort,
    PRICING_RULE_TIEBREAK,
  )

  return pageOf(db, {
    pageSql: `SELECT ${PRICING_RULE_COLUMNS} FROM pricing_rules AS p ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    countSql: `SELECT COUNT(*) AS count FROM pricing_rules AS p${where ? " " + where : ""}`,
    filterParams,
    params,
    decode: pricingRuleRow,
  })
}

export async function selectPricingRule(
  db: Pool,
  pricingRuleId: string,
): Promise<PricingRule | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT ${PRICING_RULE_COLUMNS} FROM pricing_rules AS p WHERE p.id = ?`,
    [pricingRuleId],
  )
  return rows[0] ? pricingRuleRow(rows[0]) : null
}

export async function insertPricingRule(
  db: Pool,
  record: Omit<PricingRule, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const sql = `INSERT INTO pricing_rules (name, origin_zone_id, destination_zone_id, min_weight, max_weight, base_price, price_per_kg, cod_percentage, cod_fixed_fee, express_fee, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  const [result] = await db.execute<OkPacket>(sql, [
    record.name,
    record.originZoneId,
    record.destinationZoneId,
    record.minWeight,
    record.maxWeight,
    record.basePrice,
    record.pricePerKg,
    record.codPercentage,
    record.codFixedFee,
    record.expressFee,
    record.status,
  ])
  if (!result.insertId) throw new Error("Pricing rule insert returned no id")
  return String(result.insertId)
}

export async function patchPricingRule(
  db: Pool,
  pricingRuleId: string,
  patch: Partial<Omit<PricingRule, "id" | "createdAt" | "updatedAt">>,
): Promise<PricingRule | null> {
  const { assignments, params } = buildAssignments(patch, PRICING_RULE_PATCH_COLUMNS)

  if (assignments.length === 0) return selectPricingRule(db, pricingRuleId)

  const sql = `UPDATE pricing_rules SET ${assignments.join(", ")} WHERE id = ?`
  params.push(pricingRuleId)

  await db.execute<OkPacket>(sql, params)
  return selectPricingRule(db, pricingRuleId)
}

export async function deletePricingRule(db: Pool, pricingRuleId: string): Promise<boolean> {
  const [result] = await db.execute<OkPacket>(`DELETE FROM pricing_rules WHERE id = ?`, [
    pricingRuleId,
  ])
  return Number(result.affectedRows) > 0
}
