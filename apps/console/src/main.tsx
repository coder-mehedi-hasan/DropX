import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Toaster } from "@dropx/ui"

import { AuthProvider } from "@/lib/auth"
import { queryClient } from "@/lib/query-client"
import { createConsoleRouter } from "@/router"
import { ThemeProvider, useTheme } from "@/lib/theme"

import "./index.css"

const router = createConsoleRouter(queryClient)

const container = document.getElementById("root")
if (!container) throw new Error("Root container #root is missing from index.html")

/** The toast theme follows the same class the app shell toggles. */
function ThemedToaster() {
  const { theme } = useTheme()
  return <Toaster theme={theme} position="bottom-right" richColors closeButton />
}

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
          <ThemedToaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
