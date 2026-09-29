import { Hono } from "hono"

import { mountSurface } from "../../shared/auth/surface"
import type { AppEnv } from "../../types/env"
import { adminHandlers } from "./handlers"
import { ADMIN_SURFACE } from "./registry"

/**
 * The admin surface router.
 *
 * One `mountSurface` call replaces the hand-written `parcels.routes.ts` staff
 * half: it registers each operation's policy, mounts its handler behind that
 * policy, and feeds the OpenAPI generator. There is no per-operation route
 * boilerplate left to keep in sync with a spec file.
 */
const router = new Hono<AppEnv>()

mountSurface(router, ADMIN_SURFACE, adminHandlers)

export default router
