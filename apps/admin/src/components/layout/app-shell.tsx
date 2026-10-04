import { Outlet } from "@tanstack/react-router"

import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { RequireAuth } from "@/lib/auth"

/**
 * The authenticated shell.
 *
 * `RequireAuth` wraps the shell rather than each page so no screen can be
 * reached — or briefly rendered — without a session.
 */
export function AppShell() {
  return (
    <RequireAuth>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 px-4 py-6">
            {/* `max-w-page` is the brand's 1200px content width, not a Tailwind default. */}
            <div className="max-w-page mx-auto w-full">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </RequireAuth>
  )
}
