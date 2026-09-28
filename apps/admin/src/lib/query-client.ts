import { QueryClient } from "@tanstack/react-query"

import { ApiError } from "./api-client"

/**
 * One client for the whole admin.
 *
 * Retries are suppressed for auth/permission failures: a 401 or 403 will never
 * succeed on a second attempt, and retrying them just delays the redirect to
 * login. `refetchOnWindowFocus` is off because ops staff leave parcel lists open
 * on a second monitor all day, and a silent refetch that reorders the table
 * mid-edit is worse than slightly stale counts.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.isUnauthenticated || error.isForbidden))
          return false
        return failureCount < 2
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})
