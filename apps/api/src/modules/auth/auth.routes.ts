import { ERROR_CODES, DomainError, validateJson } from "../../core"
import { getCache } from "../../shared/cache"
import { defineOperation } from "../../shared/auth/policy"
import type { AppEnv } from "../../types/env"
import { Hono } from "hono"

import { otpRequestSchema, otpVerifySchema, refreshSchema, staffLoginSchema } from "./auth.dto"
import * as authService from "./auth.service"

/**
 * Transport only: validate, call the service, shape the response.
 * No business rules and no SQL here.
 */
const router = new Hono<AppEnv>()

router.post(
  "/console/login",
  defineOperation(
    { id: "auth.loginConsole", public: true },
    { method: "POST", path: "/auth/console/login" },
  ),
  validateJson(staffLoginSchema),
  async (c) => {
    const result = await authService.loginWithPassword(
      { db: c.get("db"), cache: getCache() },
      c.req.valid("json"),
      "console",
    )
    return c.json(result)
  },
)

router.post(
  "/riders/login",
  defineOperation(
    { id: "auth.loginRider", public: true },
    { method: "POST", path: "/auth/riders/login" },
  ),
  validateJson(staffLoginSchema),
  async (c) => {
    const result = await authService.loginWithPassword(
      { db: c.get("db"), cache: getCache() },
      c.req.valid("json"),
      "riders",
    )
    return c.json(result)
  },
)

/**
 * Audience is a path segment rather than a body field, so a console refresh
 * token cannot be exchanged for a rider one.
 */
router.post(
  "/:audience/refresh",
  defineOperation(
    { id: "auth.refresh", public: true },
    { method: "POST", path: "/auth/:audience/refresh" },
  ),
  validateJson(refreshSchema),
  async (c) => {
    const audience = c.req.param("audience")
    if (audience !== "console" && audience !== "riders" && audience !== "web") {
      throw new DomainError(ERROR_CODES.VALIDATION_FAILED, "Unknown audience", {
        details: [{ field: "audience", message: "Expected console, riders or web" }],
      })
    }

    const tokens = await authService.refreshSession(
      { db: c.get("db"), cache: getCache() },
      c.req.valid("json").refreshToken,
      audience,
    )
    return c.json(tokens)
  },
)

router.post(
  "/otp/request",
  defineOperation(
    { id: "auth.otpRequest", public: true },
    { method: "POST", path: "/auth/otp/request" },
  ),
  validateJson(otpRequestSchema),
  async (c) => {
    const result = await authService.requestOtp(
      { db: c.get("db"), cache: getCache() },
      c.req.valid("json"),
    )
    // 202: the code is on its way; nothing else about the account is revealed.
    return c.json(result, 202)
  },
)

router.post(
  "/otp/verify",
  defineOperation(
    { id: "auth.otpVerify", public: true },
    { method: "POST", path: "/auth/otp/verify" },
  ),
  validateJson(otpVerifySchema),
  async (c) => {
    const result = await authService.verifyOtp(
      { db: c.get("db"), cache: getCache() },
      c.req.valid("json"),
    )
    return c.json(result)
  },
)

router.get("/me", defineOperation({ id: "auth.me" }, { method: "GET", path: "/auth/me" }), (c) => {
  const { actor, audience } = c.get("auth")

  switch (actor.kind) {
    case "staff":
      return c.json({
        kind: "staff" as const,
        audience,
        id: actor.userId,
        email: actor.email,
        roles: actor.roles,
        permissions: [...actor.permissions],
        branchId: actor.branchId,
        hubIds: actor.hubIds,
      })
    case "rider":
      return c.json({
        kind: "rider" as const,
        audience,
        id: actor.userId,
        riderId: actor.riderId,
        hubId: actor.hubId,
        email: actor.email,
        permissions: [...actor.permissions],
      })
    case "customer":
      return c.json({
        kind: "customer" as const,
        audience,
        id: actor.customerId,
        status: actor.status,
      })
    case "public":
      throw new DomainError(ERROR_CODES.UNAUTHENTICATED, "Please sign in to continue")
  }
})

router.post(
  "/logout",
  defineOperation({ id: "auth.logout" }, { method: "POST", path: "/auth/logout" }),
  (c) => {
    // Access tokens are stateless and short-lived; the client discards its
    // refresh token. Add a `sid` denylist here if instant revocation is needed.
    return c.json({ ok: true })
  },
)

export default router
