/**
 * Email job processor.
 *
 * Registers how the email queue is processed. The loop, retries, backoff and
 * stalled-job recovery all come from the generic queue module — a dead provider
 * cannot grow the queue without bound.
 */
import { getConfig } from "../../config"

import { createEmail, type EmailMessage } from "./port"
import type { EmailJob } from "./queue"
import { renderEmail } from "./templates"

let email: ReturnType<typeof createEmail> | undefined

function getEmail() {
  if (email) return email
  const config = getConfig()
  email = createEmail({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    user: config.mail.user,
    password: config.mail.password,
    from: config.mail.from,
  })
  return email
}

export async function processEmailJob(job: EmailJob): Promise<void> {
  const config = getConfig()
  const rendered = await renderEmail(job.template, job.context, {
    brandAssetUrl: config.mail.brandAssetUrl,
  })
  const message: EmailMessage = {
    to: job.to,
    subject: job.subject,
    html: rendered.html,
    text: rendered.text,
  }
  await getEmail().send(message)
}
