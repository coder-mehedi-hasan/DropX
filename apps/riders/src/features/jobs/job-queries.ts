import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { shouldRetry } from "../../lib/api-client"
import { usePermission } from "../../lib/auth"
import { RIDER_PERMISSIONS } from "../../lib/permissions"
import {
  fetchJob,
  fetchJobs,
  updateJobStatus,
  type JobStatusFilter,
  type JobStatusUpdate,
} from "./jobs.api"

/**
 * Query layer for jobs.
 *
 * `keepPreviousData` plus a generous `staleTime` is what makes the list survive
 * a dead spot: switching filter tabs or refetching keeps the last known rows on
 * screen, and a failed refetch leaves `data` intact so a rider working from a
 * stale list is never handed a blank screen.
 *
 * The read queries are gated on `rider.jobs.view` here rather than at each call
 * site, so a screen added later cannot fire a request the API will only refuse.
 */

export const jobKeys = {
  all: ["jobs"] as const,
  list: (filter: JobStatusFilter) => ["jobs", "list", filter] as const,
  detail: (parcelId: string) => ["jobs", "detail", parcelId] as const,
}

export function useJobList(filter: JobStatusFilter) {
  const canViewJobs = usePermission(RIDER_PERMISSIONS.JOBS_VIEW)

  return useQuery({
    queryKey: jobKeys.list(filter),
    queryFn: ({ signal }) => fetchJobs(filter, signal),
    enabled: canViewJobs,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: shouldRetry,
  })
}

export function useJob(parcelId: string) {
  const canViewJobs = usePermission(RIDER_PERMISSIONS.JOBS_VIEW)

  return useQuery({
    queryKey: jobKeys.detail(parcelId),
    queryFn: ({ signal }) => fetchJob(parcelId, signal),
    enabled: canViewJobs,
    staleTime: 30_000,
    retry: shouldRetry,
  })
}

export function useUpdateJobStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ parcelId, ...input }: { parcelId: string } & JobStatusUpdate) =>
      updateJobStatus(parcelId, input),
    retry: shouldRetry,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: jobKeys.all })
    },
  })
}
