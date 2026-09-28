import { Navigate, createRoute } from "@tanstack/react-router"

import { LoginScreen } from "../features/auth/login-screen"
import { rootRoute } from "./root"

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginScreen,
})

/**
 * A bare `/` is a dead end for a rider with a bookmarked or shared link: it
 * sends them to the job list, and the app layout bounces an anonymous rider to
 * the login screen from there.
 */
export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <Navigate to="/jobs" replace />,
})
