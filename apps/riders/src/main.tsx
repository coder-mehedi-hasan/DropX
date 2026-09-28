import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { AuthProvider } from "./lib/auth"
import { router } from "./router"
import { startThemeSync } from "./lib/theme"

import "./index.css"

startThemeSync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      /**
       * Riders lose signal constantly, so the window is wide and nothing is
       * thrown away on a failed refetch — a stale job list beats a blank one.
       */
      staleTime: 30_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})

const container = document.getElementById("root")
if (!container) throw new Error("Root container #root is missing from index.html")

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
