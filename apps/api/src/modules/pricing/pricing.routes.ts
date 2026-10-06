import { validateQuery } from "../../core"
import { response } from "../../core/http"
import { defineOperation } from "../../shared/auth/policy"
import type { AppEnv } from "../../types/env"
import { Hono } from "hono"

import { quoteSchema } from "./pricing.dto"
import { quoteDeliveryFee } from "./pricing.service"
import pricingRules from "./pricing-rules.routes"

/**
 * `GET /pricing/quote` — available to the admin and the customer portal so a
 * fee can be shown before committing. The client sends two city/zone pairs and
 * a weight in grams; the lane, the slab, the COD fee and the extra-weight fee
 * are all chosen here. The booking endpoint re-computes the same quote and
 * ignores anything sent with the booking.
 */
const router = new Hono<AppEnv>()

router.route("", pricingRules)

router.get(
  "/quote",
  defineOperation(
    { id: "pricing.quote", audience: ["admin", "web"] },
    { method: "GET", path: "/pricing/quote" },
  ),
  validateQuery(quoteSchema),
  async (c) => {
    const input = c.req.valid("query")
    const quote = await quoteDeliveryFee(c, {
      pickupCityId: input.pickupCityId,
      pickupZoneId: input.pickupZoneId,
      deliveryCityId: input.deliveryCityId,
      deliveryZoneId: input.deliveryZoneId,
      weightGrams: input.weightGrams,
      codAmount: input.codAmount,
    })
    return c.json(response.success(quote))
  },
)

export default router
