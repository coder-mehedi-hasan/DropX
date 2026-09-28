"use client"

import { Toaster } from "@dropx/ui"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import * as React from "react"

import { isApiError } from "@/lib/api-client"
import { AuthProvider } from "@/lib/auth"

export function Providers({ children }: { children: React.ReactNode }) {
  /**
   * Created inside state so a client-side navigation never reuses a client that
   */
  /**
   * has already thrown away cached data on a sign-out.
   */
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            /**
             * A 4xx will not turn into a 2xx on retry, and re-sending an already
             */
            /**
             * rejected request only delays the message the customer needs.
             */
            retry: (failureCount, error) => {
              if (isApiError(error) && error.status < 500) return false
              return failureCount < 2
            },
          },
          mutations: { retry: false },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </AuthProvider>
    </QueryClientProvider>
  )
}
