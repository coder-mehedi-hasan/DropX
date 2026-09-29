import { Hono } from "hono"

import { mountSurface } from "../../shared/auth/surface"
import type { AppEnv } from "../../types/env"
import { customerHandlers } from "./handlers"
import { CUSTOMER_SURFACE } from "./registry"

/**
 * The customer surface router.
 *
 * The second `mountSurface` in the app, and the proof that the registry pattern
 * was not an admin-only special case: this one has no permission keys, because a
 * customer is not an RBAC user — it is scoped by `audience` and
 * `requiresActiveCustomer` instead, enforced by the same mechanism.
 *
 * The service and repository stay in `../parcels/`; only the contract moved.
 */
const router = new Hono<AppEnv>()

mountSurface(router, CUSTOMER_SURFACE, customerHandlers)

export default router
