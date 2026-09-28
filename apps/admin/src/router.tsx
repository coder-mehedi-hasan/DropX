import type { QueryClient } from "@tanstack/react-query"
import { createRouter } from "@tanstack/react-router"

import { queryClient } from "@/lib/query-client"

import {
  appRoute,
  dashboardRoute,
  loginRoute,
  parcelDetailRoute,
  parcelsRoute,
  trackingRoute,
} from "./routes/app-routes"
import { rootRoute } from "./routes/root"

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([dashboardRoute, parcelsRoute, parcelDetailRoute, trackingRoute]),
])

/**
 * The route tree is assembled here, by hand.
 *
 * A convention-based file tree would be fine too, but the admin is small and
 * the shapes that matter — one pathless authenticated layout, and a guard on
 * every screen that needs a permission key — are easier to audit in one list
 * than spread across a directory of route files.
 */
export function createAdminRouter(client: QueryClient = queryClient) {
  return createRouter({
    routeTree,
    context: { queryClient: client },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAdminRouter>
  }
}
