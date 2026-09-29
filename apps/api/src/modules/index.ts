import type { Hono } from "hono"

import type { AppEnv } from "../types/env"
import admin from "./admin"
import auth from "./auth/auth.routes"
import health from "./health/health.routes"
import jobs from "./jobs/jobs.routes"
import parcels from "./parcels/parcels.routes"
import pricing from "./pricing/pricing.routes"
import tracking from "./tracking/tracking.routes"

/**
 * The domain aggregator.
 *
 * This is the only place a feature module gets registered. Because
 * `defineOperation` is what populates the policy catalog, a module missing from
 * this list also means its operations are unregistered — which `assertPolicyCatalog`
 * and the route smoke test will surface, rather than failing silently open.
 *
 * A *surface* (`admin`) is registered the same way as a hand-written module: it
 * exports one composed router, and `mountSurface` has already registered and
 * mounted each of its operations by the time this list is read.
 */
export type FeatureModule = {
  name: string
  basePath: string
  router: Hono<AppEnv>
}

const modules: readonly FeatureModule[] = [
  { name: "health", basePath: "/health", router: health },
  { name: "auth", basePath: "/auth", router: auth },
  { name: "tracking", basePath: "/tracking", router: tracking },
  { name: "admin", basePath: "/admin", router: admin },
  { name: "parcels", basePath: "/parcels", router: parcels },
  { name: "jobs", basePath: "/jobs", router: jobs },
  { name: "pricing", basePath: "/pricing", router: pricing },
]

export const MODULES: readonly FeatureModule[] = modules

/** Every business route is versioned; probes are not. */
export const API_BASE_PATH = "/api/v1"

export function registerModules(app: Hono<AppEnv>): void {
  for (const module of modules) {
    app.route(`${API_BASE_PATH}${module.basePath}`, module.router)

    // A future /v2 rollout must not break the load balancer's health probe,
    // so health is also served unversioned.
    if (module.name === "health") app.route(module.basePath, module.router)
  }
}

export function moduleManifest(): { name: string; basePath: string }[] {
  return modules.map(({ name, basePath }) => ({ name, basePath }))
}
