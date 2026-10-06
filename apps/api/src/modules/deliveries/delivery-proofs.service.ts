import type { Context } from "hono"

import { ERROR_CODES, DomainError, notFound } from "../../core"
import { buildPage, normalizeListParams, type Id, type Page } from "../../db/models"
import type { Scope } from "../../shared/auth/auth-context"
import type { AppEnv } from "../../types/env"

import type { ListDeliveryProofsQuery, SubmitProofInput } from "./delivery-proofs.dto"
import {
  insertDeliveryProof,
  selectAttemptForProof,
  selectDeliveryProofById,
  selectDeliveryProof,
  selectDeliveryProofs,
  selectProofsForParcelAndRider,
  verifyDeliveryProofRow,
  type DeliveryProofRow,
} from "./delivery-proofs.repository"

/**
 * Proof-of-delivery rules.
 *
 * A proof is the artefact recorded against a delivery attempt: a signature
 * image, a photo of the handover, an OTP, an ID check. Only the rider on the
 * attempt files it, and only while the attempt is out for delivery or
 * delivered — an `ASSIGNED` attempt has not started, and a failed or
 * returned attempt already has its decisive reason recorded instead.
 *
 * The rider's own writes are unverified. Verifying is an admin act against
 * `verified_at`, and the column exists so an office can confirm the image or
 * the code matches what the door gave them — a rider does not vouch for
 * themselves.
 */

export async function listDeliveryProofs(
  c: Context<AppEnv>,
  scope: Scope,
  query: ListDeliveryProofsQuery,
): Promise<Page<DeliveryProofRow>> {
  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectDeliveryProofs(c.get("db")!, scope, params, {
    type: query.type,
    verified: query.verified,
    deliveryId: query.deliveryId,
    search: query.search,
  })
  return buildPage(nodes, totalCount, params)
}

export async function getDeliveryProof(
  c: Context<AppEnv>,
  scope: Scope,
  proofId: string,
): Promise<DeliveryProofRow> {
  const proof = await selectDeliveryProof(c.get("db")!, scope, proofId)
  if (!proof) throw notFound("No such proof")
  return proof
}

export async function verifyDeliveryProof(
  c: Context<AppEnv>,
  scope: Scope,
  proofId: string,
): Promise<DeliveryProofRow> {
  const affected = await verifyDeliveryProofRow(c.get("db")!, scope, proofId)
  if (affected === 0) {
    // Distinguish "no such proof" from "already verified": a second verify is
    // a 409, not a 404.
    const existing = await selectDeliveryProof(c.get("db")!, scope, proofId)
    if (!existing) throw notFound("No such proof")
    throw new DomainError(ERROR_CODES.INVALID_STATE_TRANSITION, "This proof is already verified")
  }
  const verified = await selectDeliveryProof(c.get("db")!, scope, proofId)
  if (!verified) throw notFound("No such proof")
  return verified
}

export async function submitProof(
  c: Context<AppEnv>,
  riderId: Id,
  input: SubmitProofInput,
): Promise<DeliveryProofRow> {
  const db = c.get("db")!
  const attempt = await selectAttemptForProof(db, riderId, input.parcelId)
  if (!attempt) {
    throw new DomainError(
      ERROR_CODES.INVALID_STATE_TRANSITION,
      "There is no attempt in progress for this parcel, so no proof can be filed",
    )
  }

  const proofId = await insertDeliveryProof(db, {
    deliveryId: attempt.deliveryId,
    type: input.type,
    value: input.value ?? null,
    fileUrl: input.fileUrl ?? null,
  })

  const row = await selectDeliveryProofById(db, proofId)
  if (!row) throw notFound("No such proof")
  return row
}

export async function listJobProofs(
  c: Context<AppEnv>,
  riderId: Id,
  parcelId: string,
): Promise<DeliveryProofRow[]> {
  return selectProofsForParcelAndRider(c.get("db")!, riderId, parcelId)
}
