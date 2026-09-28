import { Link, Outlet, createRootRoute } from "@tanstack/react-router"
import { Compass } from "lucide-react"
import { Button, EmptyState } from "@dropx/ui"

/**
 * The root route owns nothing but the outlet, so a signed-out user reaching
 * `/login` never pays for the app shell — and a shell error cannot take the
 * login screen down with it.
 */
export const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return <Outlet />
}

function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4">
      <EmptyState
        className="w-full"
        icon={Compass}
        title="Page not found"
        description="That address does not match any admin screen."
        action={
          <Button asChild>
            <Link to="/">Back to the dashboard</Link>
          </Button>
        }
      />
    </div>
  )
}
