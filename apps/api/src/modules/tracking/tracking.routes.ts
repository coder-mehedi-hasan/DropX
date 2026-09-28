import { getConfig } from "../../config"
import { validateParam } from "../../core"
import { response } from "../../core/http"
import { defineOperation } from "../../shared/auth/policy"
import type { AppEnv } from "../../types/env"
import { Hono } from "hono"

import { trackingNumberSchema } from "./tracking.dto"
import { trackParcel } from "./tracking.service"
import z from "zod"

/**
 * `GET /tracking/:trackingNumber` — public, no login required.
 *
 * Explicitly `public` in the policy catalog so the exemption is visible rather
 * than implied by a missing permission check.
 */
const router = new Hono<AppEnv>()

function callerKey(c: { req: { header: (name: string) => string | undefined } }): string {
  if (!getConfig().trustProxy) return "direct"
  return (
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ||
    c.req.header("CF-Connecting-IP") ||
    "unknown"
  )
}

router.get(
  "/:trackingNumber",
  defineOperation(
    { id: "tracking.lookup", public: true },
    { method: "GET", path: "/tracking/:trackingNumber" },
  ),
  validateParam(z.object({ trackingNumber: trackingNumberSchema })),
  async (c) => {
    const result = await trackParcel(c.req.param("trackingNumber").toUpperCase(), callerKey(c))
    return c.json(response.success(result))
  },
)

export default router
