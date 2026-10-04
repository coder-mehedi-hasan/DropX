import { DomainError, fromDatabaseError, notFound } from "../../core"

import type { Context } from "hono"
import type { AppEnv } from "../../types/env"

import { buildPage, normalizeListParams, type Page } from "../../db/models"

import type { PricingRule } from "../../db/models"

import {
  deletePricingRule,
  insertPricingRule,
  patchPricingRule,
  selectPricingRule,
  selectPricingRules,
} from "./pricing-rules.repository"
import { findMatchingRule } from "./pricing.service"

import type { ListPricingRulesQuery, UpdatePricingRuleInput } from "./pricing-rules.dto"

export async function listPricingRules(
  c: Context<AppEnv>,
  query: ListPricingRulesQuery,
): Promise<Page<PricingRule>> {
  const params = normalizeListParams(query)
  const status = (query.status === "" ? undefined : query.status) as
    PricingRule["status"] | undefined
  const { nodes, totalCount } = await selectPricingRules(c.get("db")!, params, {
    status,
    search: query.search,
    originZoneId: query.originZoneId,
    destinationZoneId: query.destinationZoneId,
  })
  return buildPage(nodes, totalCount, params)
}

export async function readPricingRule(
  c: Context<AppEnv>,
  pricingRuleId: string,
): Promise<PricingRule> {
  const pricingRule = await selectPricingRule(c.get("db")!, pricingRuleId)
  if (!pricingRule) throw notFound("No such pricing rule")
  return pricingRule
}

export async function createPricingRule(
  c: Context<AppEnv>,
  input: Parameters<typeof insertPricingRule>[1],
): Promise<PricingRule> {
  try {
    const id = await insertPricingRule(c.get("db")!, input)
    const pricingRule = await selectPricingRule(c.get("db")!, id)
    if (!pricingRule) throw new Error("Pricing rule disappeared immediately after insert")
    return pricingRule
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "A pricing rule with that zone pair and weight band")
  }
}

export async function updatePricingRule(
  c: Context<AppEnv>,
  pricingRuleId: string,
  patch: UpdatePricingRuleInput,
): Promise<PricingRule> {
  try {
    const pricingRule = await patchPricingRule(c.get("db")!, pricingRuleId, patch)
    if (!pricingRule) throw notFound("No such pricing rule")
    return pricingRule
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "A pricing rule with that zone pair and weight band")
  }
}

export async function deletePricingRuleService(
  c: Context<AppEnv>,
  pricingRuleId: string,
): Promise<void> {
  const exists = await selectPricingRule(c.get("db")!, pricingRuleId)
  if (!exists) throw notFound("No such pricing rule")

  try {
    const deleted = await deletePricingRule(c.get("db")!, pricingRuleId)
    if (!deleted) throw new Error("Pricing rule disappeared during delete")
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "Cannot delete the pricing rule")
  }
}

export async function matchPricingRule(
  c: Context<AppEnv>,
  query: { originZoneId: string; destinationZoneId: string; weightKg: number },
): Promise<PricingRule | null> {
  const rule = await findMatchingRule(c, {
    originZoneId: query.originZoneId,
    destinationZoneId: query.destinationZoneId,
    weightKg: query.weightKg,
    codAmount: 0,
    express: false,
  })
  return rule ? selectPricingRule(c.get("db")!, String(rule.id)) : null
}
