import { Outlet, createRoute } from "@tanstack/react-router"

import { RequireAuth } from "../lib/auth"
import { rootRoute } from "./root"

/**
 * Pathless authenticated layout.
 *
 * The guard lives on the layout rather than on each child, so a new rider screen
 * is protected by default — a screen added without a guard fails closed instead
 * of rendering an empty list to an anonymous rider.
 */
export const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: () => (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  ),
})
