import { validateJson, validateParam, validateQuery } from "../../core"
import { response } from "../../core/http"
import { defineOperation } from "../../shared/auth/policy"
import { PERMISSIONS } from "../../shared/auth/permissions"
import type { AppEnv } from "../../types/env"
import { Hono } from "hono"

import {
  createPricingRuleSchema,
  listPricingRulesQuerySchema,
  matchPricingRulesQuerySchema,
  pricingRuleIdParamSchema,
  updatePricingRuleSchema,
} from "./pricing-rules.dto"
import * as pricingRules from "./pricing-rules.service"

/**
 * Pricing-rules CRUD for staff.
 *
 * Hand-written (not registry-driven) like the sibling `pricing.quote` route:
 * `defineOperation` registers the policy, the Zod DTOs are the contract, and
 * the OpenAPI fragment lives in `openapi/paths/pricing.openapi.ts`.
 *
 * Paths are relative — this router mounts under `/pricing`, so `GET /rules`
 * serves `/api/v1/pricing/rules`. `/match` is declared before `/:id` because
 * Hono matches in order and `match` would otherwise parse as an id.
 */
const router = new Hono<AppEnv>()

router.get(
  "/rules",
  defineOperation(
    { id: "admin.pricing.list", audience: ["admin"], permissions: [PERMISSIONS.PRICING_VIEW] },
    { method: "GET", path: "/pricing/rules" },
  ),
  validateQuery(listPricingRulesQuerySchema),
  async (c) => {
    const page = await pricingRules.listPricingRules(c, c.req.valid("query"))
    return c.json(response.success(page))
  },
)

router.get(
  "/rules/match",
  defineOperation(
    { id: "admin.pricing.match", audience: ["admin"], permissions: [PERMISSIONS.PRICING_VIEW] },
    { method: "GET", path: "/pricing/rules/match" },
  ),
  validateQuery(matchPricingRulesQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const rule = await pricingRules.matchPricingRule(c, {
      originZoneId: query.originZoneId,
      destinationZoneId: query.destinationZoneId,
      weightKg: query.weightKg,
    })
    if (!rule) {
      return c.json(
        response.error("NOT_FOUND", "No active pricing rule covers that route and weight."),
        404,
      )
    }
    return c.json(response.success(rule))
  },
)

router.get(
  "/rules/:id",
  defineOperation(
    { id: "admin.pricing.read", audience: ["admin"], permissions: [PERMISSIONS.PRICING_VIEW] },
    { method: "GET", path: "/pricing/rules/:id" },
  ),
  validateParam(pricingRuleIdParamSchema),
  async (c) => {
    const rule = await pricingRules.readPricingRule(c, c.req.valid("param").id)
    return c.json(response.success(rule))
  },
)

router.post(
  "/rules",
  defineOperation(
    { id: "admin.pricing.create", audience: ["admin"], permissions: [PERMISSIONS.PRICING_MANAGE] },
    { method: "POST", path: "/pricing/rules" },
  ),
  validateJson(createPricingRuleSchema),
  async (c) => {
    const rule = await pricingRules.createPricingRule(c, c.req.valid("json"))
    return c.json(response.success(rule), 201)
  },
)

router.patch(
  "/rules/:id",
  defineOperation(
    { id: "admin.pricing.update", audience: ["admin"], permissions: [PERMISSIONS.PRICING_MANAGE] },
    { method: "PATCH", path: "/pricing/rules/:id" },
  ),
  validateParam(pricingRuleIdParamSchema),
  validateJson(updatePricingRuleSchema),
  async (c) => {
    const rule = await pricingRules.updatePricingRule(
      c,
      c.req.valid("param").id,
      c.req.valid("json"),
    )
    return c.json(response.success(rule))
  },
)

router.delete(
  "/rules/:id",
  defineOperation(
    { id: "admin.pricing.delete", audience: ["admin"], permissions: [PERMISSIONS.PRICING_MANAGE] },
    { method: "DELETE", path: "/pricing/rules/:id" },
  ),
  validateParam(pricingRuleIdParamSchema),
  async (c) => {
    await pricingRules.deletePricingRuleService(c, c.req.valid("param").id)
    return c.status(204)
  },
)

export default router
