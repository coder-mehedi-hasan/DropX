import {
  buildPage,
  canTransitionParcel,
  canTransitionPickup,
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
import type {
  ListJobsQuery,
  UpdateJobStatusInput,
  UpdatePickupJobStatusInput,
} from "./jobs.dto"
import {
  closeAttempt,
  findJobForRider,
  findOpenAttemptForUpdate,
  listPickupJobsForRider,
  findPickupJobForRider,
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

export async function listPickupJobs(
  c: Context<AppEnv>,
  riderId: Id,
  query: { page: number; limit: number; status?: import("@dropx/types").PickupStatus },
) {
  const params = normalizeListParams({ page: query.page, limit: query.limit })
  const { nodes, totalCount } = await listPickupJobsForRider(
    c.get("db")!,
    riderId,
    params,
    query.status,
  )
  return buildPage(
    nodes.map((job) => ({
      pickup: {
        id: job.pickupId,
        status: job.pickupStatus,
        address: job.pickupAddress,
        scheduledAt: job.scheduledAt,
        pickedUpAt: job.pickedUpAt,
        failureReason: job.failureReason,
      },
      parcel: {
        id: job.parcelId,
        trackingNumber: job.trackingNumber,
        status: job.parcelStatus,
        weight: Number(job.weight),
        codAmount: Number(job.codAmount),
        paymentType: job.paymentType,
        createdAt: job.createdAt,
      },
    })),
    totalCount,
    params,
  )
}

export async function getJob(c: Context<AppEnv>, riderId: Id, parcelId: Id): Promise<JobDetail> {
  const db = c.get("db")!
  const job = await findJobForRider(db, riderId, parcelId)
  if (!job) throw notFound("That job is not assigned to you")

  const items = await listJobItems(db, job.parcel.id)
  return { ...job, items }
}

export async function updatePickupJobStatus(
  c: Context<AppEnv>,
  command: {
    riderId: Id
    riderUserId: Id
    pickupId: Id
    input: UpdatePickupJobStatusInput
  },
) {
  const nextParcelStatus = command.input.status === "PICKED_UP" ? "PICKED_UP" : undefined

  await withTransaction(c.get("db")!, async (tx) => {
    const pickup = await findPickupJobForRider(tx, command.riderId, command.pickupId, true)
    if (!pickup) throw notFound("That pickup is not assigned to you")
    if (!canTransitionPickup(pickup.pickupStatus, command.input.status)) {
      throw new DomainError(
        ERROR_CODES.INVALID_STATE_TRANSITION,
        `A pickup cannot move from ${pickup.pickupStatus} to ${command.input.status}`,
      )
    }

    await tx.execute(
      `UPDATE pickups
          SET status = ?,
              picked_up_at = CASE WHEN ? = 'PICKED_UP' THEN CURRENT_TIMESTAMP ELSE picked_up_at END,
              failure_reason = CASE WHEN ? = 'FAILED' THEN ? ELSE NULL END
        WHERE id = ? AND assigned_rider_id = ?`,
      [
        command.input.status,
        command.input.status,
        command.input.status,
        command.input.reason ?? null,
        command.pickupId,
        command.riderId,
      ],
    )

    if (nextParcelStatus) {
      await tx.execute(`UPDATE parcels SET status = ? WHERE id = ?`, [nextParcelStatus, pickup.parcelId])
    }

    await insertParcelEvent(tx, {
      parcelId: pickup.parcelId,
      eventType: nextParcelStatus ?? "ARRIVED_HUB",
      userId: command.riderUserId,
      riderId: command.riderId,
      description:
        command.input.reason ?? `Rider marked pickup ${command.input.status.toLowerCase()}`,
    })
  })

  const updated = await findPickupJobForRider(c.get("db")!, command.riderId, command.pickupId)
  if (!updated) throw notFound("That pickup is no longer available")
  return {
    pickup: {
      id: updated.pickupId,
      status: updated.pickupStatus,
      address: updated.pickupAddress,
      scheduledAt: updated.scheduledAt,
      pickedUpAt: updated.pickedUpAt,
      failureReason: updated.failureReason,
    },
    parcel: {
      id: updated.parcelId,
      trackingNumber: updated.trackingNumber,
      status: updated.parcelStatus,
      weight: Number(updated.weight),
      codAmount: Number(updated.codAmount),
      paymentType: updated.paymentType,
      createdAt: updated.createdAt,
    },
  }
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
