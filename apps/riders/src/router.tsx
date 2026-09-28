import { createRouter } from "@tanstack/react-router"

import { NotFoundScreen } from "./components/not-found-screen"
import { RouteError, RoutePending } from "./components/route-state"
import { appLayoutRoute } from "./routes/app-layout"
import { jobDetailRoute } from "./routes/job-detail"
import { jobsRoute } from "./routes/jobs"
import { indexRoute, loginRoute } from "./routes/login"
import { profileRoute } from "./routes/profile"
import { rootRoute } from "./routes/root"

/**
 * Code-based route tree.
 *
 * Declared explicitly rather than generated from the filesystem: the rider app's
 * route table is small, and the guard placement in `app-layout` is easier to
 * audit by reading one file than by inferring it from directory names.
 *
 *   /                → redirect to /jobs
 *   /login           → rider email + password
 *   /jobs            → today's jobs (search: ?status=)
 *   /jobs/$jobId     → one job: parcel, items, status actions, proof
 *   /profile         → identity, permissions, appearance, sign out
 */
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  appLayoutRoute.addChildren([jobsRoute, jobDetailRoute, profileRoute]),
])

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultPendingComponent: RoutePending,
  defaultErrorComponent: RouteError,
  defaultNotFoundComponent: NotFoundScreen,
  scrollRestoration: true,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
