import { validateQuery } from "../../core"
import { defineOperation } from "../../shared/auth/policy"
import type { AppEnv } from "../../types/env"
import { Hono } from "hono"

import { quoteSchema } from "./pricing.dto"
import { quoteDeliveryFee } from "./pricing.service"

/**
 * `GET /pricing/quote` — available to the console and the customer portal so a
 * fee can be shown before committing. Customers see the quote only; the booking
 * endpoint re-computes it and ignores anything sent here.
 */
const router = new Hono<AppEnv>()

router.get(
  "/quote",
  defineOperation(
    { id: "pricing.quote", audience: ["console", "web"] },
    { method: "GET", path: "/pricing/quote" },
  ),
  validateQuery(quoteSchema),
  async (c) => {
    const input = c.req.valid("query")
    const quote = await quoteDeliveryFee(c.get("db"), {
      originZoneId: input.originZoneId,
      destinationZoneId: input.destinationZoneId,
      weightKg: input.weightKg,
      codAmount: input.codAmount,
      express: input.express,
    })
    return c.json(quote)
  },
)

export default router
