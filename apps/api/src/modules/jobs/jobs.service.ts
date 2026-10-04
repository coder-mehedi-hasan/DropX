import {
  buildPage,
  canTransitionParcel,
  normalizeListParams,
  type Id,
  type Job,
  type JobDetail,
  type Page,
} from "../../db/models"

import type { Context } from "hono"
import type { AppEnv } from "../../types/env"
import { withTransaction } from "../../db/transaction"

import { ERROR_CODES, DomainError, notFound } from "../../core"
import { insertParcelEvent } from "../parcels/parcels.repository"
import type { ListJobsQuery, UpdateJobStatusInput } from "./jobs.dto"
import {
  closeAttempt,
  findJobForRider,
  findOpenAttemptForUpdate,
  listJobItems,
  listJobsForRider,
} from "./jobs.repository"

/**
 * Rider job rules.
 *
 * A rider reports an outcome, not a parcel status: this service maps the four
 * reportable delivery outcomes onto both the `deliveries` attempt and the
 * `parcels.status`, because the parcel is what the customer tracks. Both rows
 * and the tracking event move in one transaction — a DELIVERED delivery with a
 * still-`OUT_FOR_DELIVERY` parcel is the exact inconsistency this prevents.
 */

const PARCEL_STATUS_FOR_OUTCOME = {
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  FAILED: "FAILED",
  RETURNED: "RETURNED",
} as const

export async function listJobs(
  c: Context<AppEnv>,
  riderId: Id,
  query: ListJobsQuery,
): Promise<Page<Job>> {
  const params = normalizeListParams({ page: query.page, limit: query.limit })

  const { nodes, totalCount } = await listJobsForRider(
    c.get("db")!,
    riderId,
    params,
    query.status,
    query.search,
  )

  return buildPage(nodes, totalCount, params)
}

export async function getJob(c: Context<AppEnv>, riderId: Id, parcelId: Id): Promise<JobDetail> {
  const db = c.get("db")!
  const job = await findJobForRider(db, riderId, parcelId)
  if (!job) throw notFound("That job is not assigned to you")

  const items = await listJobItems(db, job.parcel.id)
  return { ...job, items }
}

export type ReportOutcomeCommand = {
  riderId: Id
  riderUserId: Id
  parcelId: Id
  input: UpdateJobStatusInput
}

export async function reportOutcome(
  c: Context<AppEnv>,
  command: ReportOutcomeCommand,
): Promise<JobDetail> {
  const { riderId, parcelId, input } = command
  const nextStatus = PARCEL_STATUS_FOR_OUTCOME[input.status]

  const parcelIdAfter = await withTransaction(c.get("db")!, async (tx) => {
    const attempt = await findOpenAttemptForUpdate(tx, riderId, parcelId)
    if (!attempt) {
      throw new DomainError(
        ERROR_CODES.INVALID_STATE_TRANSITION,
        "This job is not open, so its status cannot change",
      )
    }

    const current = attempt.status_before
    if (!canTransitionParcel(current, nextStatus)) {
      throw new DomainError(
        ERROR_CODES.INVALID_STATE_TRANSITION,
        `A parcel cannot move from ${current} to ${nextStatus}`,
      )
    }

    await closeAttempt(tx, attempt.id, attempt.attempt_no, input.status, input.reason ?? null)

    // The parcel row is what customers track, so it moves with the attempt.
    await tx.execute(
      `UPDATE parcels SET status = ?, current_hub_id = current_hub_id WHERE id = ?`,
      [nextStatus, parcelId],
    )

    await insertParcelEvent(tx, {
      parcelId,
      eventType: nextStatus,
      userId: command.riderUserId,
      description:
        input.reason ?? `Rider reported ${input.status.toLowerCase().replaceAll("_", " ")}`,
    })

    return parcelId
  })

  return getJob(c, riderId, parcelIdAfter)
}
