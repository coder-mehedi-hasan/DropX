import { createRoute } from "@tanstack/react-router"

import { ProfileScreen } from "../features/profile/profile-screen"
import { appLayoutRoute } from "./app-layout"

export const profileRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/profile",
  component: ProfileScreen,
})
