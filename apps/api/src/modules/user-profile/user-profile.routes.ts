import { Hono } from "hono"
import type { Context } from "hono"

import { DomainError, ERROR_CODES, validateJson } from "../../core"
import { response } from "../../core/http"
import { defineOperation } from "../../shared/auth/policy"
import type { AppEnv } from "../../types/env"
import { updateUserProfileSchema } from "./user-profile.dto"
import { getUserProfile, updateUserProfile } from "./user-profile.service"

/**
 * The user's own profile — riders and staff are the same `users` row.
 *
 * Both audiences authenticate as a `users` account (the rider just gets an
 * extra `riders` row), so one surface serves both apps. Nothing here decides
 * policy — the audience guard does — and no permission key is involved because
 * this is the signed-in account looking at itself, like a customer.
 */
const router = new Hono<AppEnv>()

function currentUserId(c: Context<AppEnv>): string {
  const { actor } = c.get("auth")
  if (actor.kind !== "rider" && actor.kind !== "staff") {
    throw new DomainError(ERROR_CODES.FORBIDDEN, "This surface is for signed-in staff and riders")
  }
  return actor.userId
}

router.get(
  "/",
  defineOperation(
    { id: "userProfile.read", audience: ["riders", "admin"] },
    { method: "GET", path: "/user/profile" },
  ),
  async (c) => c.json(response.success(await getUserProfile(c, currentUserId(c)))),
)

router.patch(
  "/",
  defineOperation(
    { id: "userProfile.update", audience: ["riders", "admin"] },
    { method: "PATCH", path: "/user/profile" },
  ),
  validateJson(updateUserProfileSchema),
  async (c) => c.json(response.success(await updateUserProfile(c, currentUserId(c), c.req.valid("json")))),
)

export default router