import { Outlet } from "@tanstack/react-router"
import { SidebarInset, SidebarProvider } from "@dropx/ui"

import { Header } from "@/components/layout/header"
import { AppSidebar } from "@/components/layout/sidebar"
import { RequireAuth } from "@/lib/auth"

/**
 * The authenticated shell.
 *
 * `RequireAuth` wraps the shell rather than each page so no screen can be
 * reached — or briefly rendered — without a session. `SidebarProvider` owns the
 * collapse state for both the desktop panel and its mobile sheet, so the two
 * are one nav with one open/closed memory.
 */
export function AppShell() {
  return (
    <RequireAuth>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Header />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="w-full">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </RequireAuth>
  )
}
