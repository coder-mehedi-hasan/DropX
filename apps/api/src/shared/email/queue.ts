/**
 * Email queue binding.
 *
 * The queue itself is generic (`shared/queue`); this file only declares what an
 * email job *is*. Adding a second queue means copying this shape, not the wiring.
 */
import { enqueue } from "../queue"

import type { TemplateName } from "./templates"

export const EMAIL_QUEUE = "email"

export type EmailJob = {
  to: string
  template: TemplateName
  context: { code: string }
  subject: string
}

export async function pushEmailJob(job: EmailJob): Promise<void> {
  await enqueue(EMAIL_QUEUE, job)
}
