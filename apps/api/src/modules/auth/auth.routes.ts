import { ERROR_CODES, DomainError, validateJson } from "../../core"
import { response } from "../../core/http"
import { defineOperation } from "../../shared/auth/policy"
import type { AppEnv } from "../../types/env"
import { Hono } from "hono"

import {
  changePasswordSchema,
  otpRequestSchema,
  otpVerifySchema,
  refreshSchema,
  staffLoginSchema,
} from "./auth.dto"
import * as authService from "./auth.service"

/**
 * Transport only: validate, call the service, shape the response.
 * No business rules and no SQL here.
 */
const router = new Hono<AppEnv>()

router.post(
  "/admin/login",
  defineOperation(
    { id: "auth.loginAdmin", public: true },
    { method: "POST", path: "/auth/admin/login" },
  ),
  validateJson(staffLoginSchema),
  async (c) => {
    const result = await authService.loginWithPassword(c, c.req.valid("json"), "admin")
    return c.json(response.success(result))
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
    const result = await authService.loginWithPassword(c, c.req.valid("json"), "riders")
    return c.json(response.success(result))
  },
)

/**
 * Audience is a path segment rather than a body field, so an admin refresh
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
    if (audience !== "admin" && audience !== "riders" && audience !== "web") {
      throw new DomainError(ERROR_CODES.VALIDATION_FAILED, "Unknown audience", {
        details: [{ field: "audience", message: "Expected admin, riders or web" }],
      })
    }

    const tokens = await authService.refreshSession(c, c.req.valid("json").refreshToken, audience)
    return c.json(response.success(tokens))
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
    const result = await authService.requestOtp(c, c.req.valid("json"))
    // 202: the code is on its way; nothing else about the account is revealed.
    return c.json(response.success(result, 202), 202)
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
    const result = await authService.verifyOtp(c, c.req.valid("json"))
    return c.json(response.success(result))
  },
)

router.get(
  "/me",
  defineOperation(
    { id: "auth.me", allowPasswordChangeRequired: true },
    { method: "GET", path: "/auth/me" },
  ),
  (c) => {
    const { actor, audience } = c.get("auth")

    switch (actor.kind) {
      case "staff":
        return c.json(
          response.success({
            kind: "staff" as const,
            audience,
            id: actor.userId,
            email: actor.email,
            roles: actor.roles,
            permissions: [...actor.permissions],
            mustChangePassword: false,
            branchId: actor.branchId,
            hubIds: actor.hubIds,
          }),
        )
      case "rider":
        return c.json(
          response.success({
            kind: "rider" as const,
            audience,
            id: actor.userId,
            riderId: actor.riderId,
            hubId: actor.hubId,
            email: actor.email,
            mustChangePassword: actor.mustChangePassword,
            permissions: [...actor.permissions],
          }),
        )
      case "customer":
        return c.json(
          response.success({
            kind: "customer" as const,
            audience,
            id: actor.customerId,
            status: actor.status,
          }),
        )
      case "public":
        throw new DomainError(ERROR_CODES.UNAUTHENTICATED, "Please sign in to continue")
    }
  },
)

router.post(
  "/riders/password",
  defineOperation(
    { id: "auth.changeRiderPassword", audience: ["riders"], allowPasswordChangeRequired: true },
    { method: "POST", path: "/auth/riders/password" },
  ),
  validateJson(changePasswordSchema),
  async (c) => {
    const auth = c.get("auth")
    if (auth.actor.kind !== "rider") {
      throw new DomainError(ERROR_CODES.FORBIDDEN, "This app is for riders")
    }
    return c.json(
      response.success(
        await authService.changeRiderPassword(c, auth.actor.userId, c.req.valid("json")),
      ),
    )
  },
)

router.post(
  "/logout",
  defineOperation(
    { id: "auth.logout", allowPasswordChangeRequired: true },
    { method: "POST", path: "/auth/logout" },
  ),
  (c) => {
    // Access tokens are stateless and short-lived; the client discards its
    // refresh token. Add a `sid` denylist here if instant revocation is needed.
    return c.json(response.success({ ok: true }))
  },
)

export default router
