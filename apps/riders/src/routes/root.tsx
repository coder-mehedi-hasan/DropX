import { Outlet, createRootRoute } from "@tanstack/react-router"

/**
 * Root route.
 *
 * The pending, error and not-found boundaries are registered on the router in
 * `router.tsx`, so every route inherits the same recovery behaviour and an
 * unknown deep link gets a real screen instead of a blank page on a phone.
 */
export const rootRoute = createRootRoute({
  component: Outlet,
})
