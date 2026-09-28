import { AttemptBadge } from "@dropx/ui"

import type { Job } from "../../lib/domain"

/**
 * The delivery attempt a rider is acting on.
 *
 * Uses the shared AttemptBadge (dot + ink label) so attempt colour is never the
 * only signal, and the attempt number keeps a re-attempt from reading as a
 * first-time failure.
 */
export function DeliveryAttemptBadge({ delivery }: { delivery: Job["delivery"] }) {
  return <AttemptBadge status={delivery.status} attemptNo={delivery.attemptNo} />
}
