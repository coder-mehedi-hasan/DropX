import { apiRequest } from "../../lib/api-client"
import type { DeliveryStatus, Job, JobDetail, Page, RiderPickupJob } from "../../lib/domain"

/**
 * Rider jobs.
 *
 * `apps/api` exposes a rider surface of its own — `GET /jobs`,
 * `GET /jobs/:id` and `PATCH /jobs/:id/status` on the `riders` audience, gated on
 * the `rider.jobs.*` keys — and the repository scopes every query to the signed
 * in rider's own delivery attempts. This module is the single place that mapping
 * lives: no screen builds a job URL, and the admin `parcels` surface a rider
 * token is refused on is never called.
 *
 * The list filters on a *delivery* status, not a parcel status. A job is one
 * attempt, so `ASSIGNED` is the work a rider still has to collect from the hub
 * and `OUT_FOR_DELIVERY` the work left at the door — a distinction the parcel
 * statuses alone cannot make.
 */

/**
 * `ALL` sends no `status` at all rather than inventing a value the query DTO
 * does not accept: the endpoint has no unfiltered mode, so the request falls back
 * to the API's `ASSIGNED` default until that route can return every attempt.
 */
export const JOB_STATUS_FILTERS = [
  "ASSIGNED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "ALL",
] as const

export type JobStatusFilter = (typeof JOB_STATUS_FILTERS)[number]

export const JOB_STATUS_FILTER_LABELS: Record<JobStatusFilter, string> = {
  ASSIGNED: "Assigned",
  OUT_FOR_DELIVERY: "To deliver",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  ALL: "All",
}

export const DEFAULT_JOB_STATUS_FILTER: JobStatusFilter = "ASSIGNED"

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  ASSIGNED: "Assigned",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
}

const OPEN_DELIVERY_STATUSES: readonly DeliveryStatus[] = ["ASSIGNED", "OUT_FOR_DELIVERY"]

/**
 * Only an open attempt accepts an outcome — the API locks the attempt row and
 * refuses anything else — so the action is disabled up front instead of being
 * left to fail on submit with a transition error.
 */
export function isTerminalStatus(status: DeliveryStatus): boolean {
  return !OPEN_DELIVERY_STATUSES.includes(status)
}

export function isJobStatusFilter(value: unknown): value is JobStatusFilter {
  return typeof value === "string" && (JOB_STATUS_FILTERS as readonly string[]).includes(value)
}

/** The outcomes a rider may report, as accepted by the status endpoint. */
export type JobOutcome = "OUT_FOR_DELIVERY" | "DELIVERED" | "FAILED" | "RETURNED"

export type JobStatusUpdate = {
  status: JobOutcome
  reason?: string
}

export async function fetchJobs(filter: JobStatusFilter, signal?: AbortSignal): Promise<Page<Job>> {
  return apiRequest<Page<Job>>("/jobs", {
    auth: true,
    signal,
    query: {
      limit: 50,
      ...(filter === "ALL" ? {} : { status: filter }),
    },
  })
}

export async function fetchPickupJobs(
  filter: JobStatusFilter,
  signal?: AbortSignal,
): Promise<Page<RiderPickupJob>> {
  return apiRequest<Page<RiderPickupJob>>("/jobs/pickups", {
    auth: true,
    signal,
    query: {
      limit: 50,
      ...(filter === "ASSIGNED" ? { status: "ASSIGNED" } : {}),
      ...(filter === "FAILED" ? { status: "FAILED" } : {}),
    },
  })
}

export type PickupJobStatusUpdate = {
  status: "IN_PROGRESS" | "PICKED_UP" | "FAILED"
  reason?: string
}

export async function updatePickupJobStatus(
  pickupId: string,
  input: PickupJobStatusUpdate,
): Promise<RiderPickupJob> {
  return apiRequest<RiderPickupJob>(`/jobs/pickups/${pickupId}/status`, {
    auth: true,
    method: "PATCH",
    body: input,
  })
}

/** `:id` is a parcel id — the API resolves it through the rider's own attempts. */
export async function fetchJob(parcelId: string, signal?: AbortSignal): Promise<JobDetail> {
  return apiRequest<JobDetail>(`/jobs/${parcelId}`, { auth: true, signal })
}

export async function updateJobStatus(
  parcelId: string,
  input: JobStatusUpdate,
): Promise<JobDetail> {
  return apiRequest<JobDetail>(`/jobs/${parcelId}/status`, {
    auth: true,
    method: "PATCH",
    body: input,
  })
}

export type ProofType = "SIGNATURE" | "PHOTO" | "OTP" | "IDENTITY"

export type JobProof = {
  id: string
  deliveryId: string
  type: ProofType
  value: string | null
  fileUrl: string | null
  verifiedAt: string | null
  createdAt: string
}

export type SubmitProofInput = {
  parcelId: string
  type: ProofType
  value?: string
  fileUrl?: string
}

export async function fetchJobProofs(parcelId: string, signal?: AbortSignal): Promise<JobProof[]> {
  return apiRequest<JobProof[]>(`/jobs/${parcelId}/proofs`, { auth: true, signal })
}

export async function submitJobProof(input: SubmitProofInput): Promise<JobProof> {
  return apiRequest<JobProof>(`/jobs/proofs`, {
    auth: true,
    method: "POST",
    body: input,
  })
}
