import { apiRequest } from "../../lib/api-client"

/**
 * The rider's own profile.
 *
 * `apps/api` exposes one user-profile surface for both the riders and admin
 * audiences (`/user/profile` on the token's own `users` id) — riders and staff
 * are the same `users` row. Email and phone are read-only identifiers; this
 * module mutates name and the stored avatar URL, and nothing else.
 */

export type UserProfile = {
  id: string
  name: string
  email: string
  phone: string | null
  avatarUrl: string | null
  createdAt: string
}

export type UpdateUserProfileInput = {
  name?: string
  /** `null` (or the empty string) removes the picture; a URL sets it. */
  avatarUrl?: string | null
}

export async function fetchUserProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>("/user/profile", { auth: true })
}

export async function updateUserProfile(input: UpdateUserProfileInput): Promise<UserProfile> {
  return apiRequest<UserProfile>("/user/profile", { auth: true, method: "PATCH", body: input })
}

export type UploadPurpose = "avatar" | "proof"

export type UploadResult = {
  url: string
  key: string
  size: number
  contentType: string
}

/**
 * Generic file upload — every rider feature that needs stored bytes (avatar,
 * delivery proof, …) calls this and persists the returned URL. The purpose
 * gates the type allowlist and size ceiling server-side.
 */
export async function uploadFile(purpose: UploadPurpose, file: File): Promise<UploadResult> {
  const form = new FormData()
  form.set("purpose", purpose)
  form.set("file", file)
  return apiRequest<UploadResult>("/uploads", { auth: true, method: "POST", body: form })
}