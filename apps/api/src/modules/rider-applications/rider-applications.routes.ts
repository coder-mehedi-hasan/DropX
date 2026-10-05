import { Hono } from "hono"

import { validateJson } from "../../core"
import { response } from "../../core/http"
import { defineOperation } from "../../shared/auth/policy"
import type { AppEnv } from "../../types/env"

import { riderApplicationSchema } from "./rider-applications.dto"
import { insertRiderApplication } from "./rider-applications.repository"

const router = new Hono<AppEnv>()

router.post(
  "/",
  defineOperation(
    { id: "riderApplication.create", public: true },
    { method: "POST", path: "/rider-applications" },
  ),
  validateJson(riderApplicationSchema),
  async (c) => {
    const id = await insertRiderApplication(c.get("db")!, c.req.valid("json"))
    return c.json(response.success({ id, status: "PENDING" as const }), 201)
  },
)

export default router
