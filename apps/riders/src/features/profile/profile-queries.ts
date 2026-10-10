import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { shouldRetry } from "../../lib/api-client"
import {
  fetchUserProfile,
  updateUserProfile,
  uploadFile,
  type UpdateUserProfileInput,
  type UploadPurpose,
} from "./profile.api"

/**
 * Query layer for the rider's own profile.
 *
 * The read is cached briefly so the header and the edit card agree on the same
 * row, and the update invalidates it so a later profile edit sees fresh data.
 */

export const profileKeys = {
  mine: ["user-profile", "mine"] as const,
}

export function useUserProfile() {
  return useQuery({
    queryKey: profileKeys.mine,
    queryFn: fetchUserProfile,
    staleTime: 30_000,
    retry: shouldRetry,
  })
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateUserProfileInput) => updateUserProfile(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["user-profile"] })
    },
  })
}

export function useUpload() {
  return useMutation({
    mutationFn: (input: { purpose: UploadPurpose; file: File }) =>
      uploadFile(input.purpose, input.file),
  })
}