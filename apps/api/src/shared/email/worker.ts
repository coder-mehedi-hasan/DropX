/**
 * Email worker.
 *
 * Pops jobs off the Redis queue and delivers them. Runs as a long-lived
 * process alongside the API. A failed send is retried up to a cap; jobs past
 * the cap are logged and dropped so a dead provider cannot grow the queue
 * without bound.
 */
import { getConfig } from "../../config"
import { createEmail, type EmailMessage } from "./port"
import { createQueue, type EmailJob } from "./queue"
import { renderEmail } from "./templates"

const MAX_ATTEMPTS = 3
const POP_TIMEOUT_MS = 5_000

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

async function deliver(job: EmailJob): Promise<void> {
  const rendered = await renderEmail(job.template, job.context)
  const message: EmailMessage = {
    to: job.to,
    subject: job.subject,
    html: rendered.html,
    text: rendered.text,
  }
  await getEmail().send(message)
}

export async function runEmailWorker(): Promise<never> {
  const queue = createQueue(process.env.REDIS_URL ?? "redis://localhost:6379")
  console.info("[worker] email queue started")

  for (;;) {
    const job = await queue.pop(POP_TIMEOUT_MS)
    if (!job) continue

    try {
      await deliver(job)
    } catch (error) {
      if (job.attempts + 1 >= MAX_ATTEMPTS) {
        console.error("[worker] email permanently failed", {
          to: job.to,
          attempts: job.attempts,
          error,
        })
        continue
      }
      console.warn(`[worker] email failed (attempt ${job.attempts + 1}), retrying`, error)
      await queue.retry(job)
    }
  }
}
