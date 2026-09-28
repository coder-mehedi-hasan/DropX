/**
 * Email queue.
 *
 * Fire-and-forget jobs pushed to a Redis list. A background worker pops them
 * and delivers via the transport. Decoupling means:
 *   - the request handler never waits on SMTP, so a slow provider cannot stall
 *     an OTP request,
 *   - a failed send is retried by the worker rather than killing the caller.
 *
 * The queue uses Redis lists with a processing list (BRPOPLPUSH / LREM), so a
 * worker crash leaves jobs recoverable instead of losing them after a pop.
 */
import { createClient, type RedisClientType } from "redis"

import { type TemplateName } from "./templates"

export type EmailJob = {
  to: string
  template: TemplateName
  context: { code: string }
  subject: string
  /** Number of delivery attempts so far. */
  attempts: number
}

const QUEUE_KEY = "queue:email"
const PROCESSING_KEY = "queue:email:processing"

function createQueueClient(url: string): RedisClientType {
  const client = createClient({ url })
  client.on("error", (error) => console.error("[queue] redis error", error))
  return client
}

async function connect(client: RedisClientType): Promise<RedisClientType> {
  if (!client.isOpen) await client.connect()
  return client
}

export function getQueueUrl(): string {
  return process.env.REDIS_URL ?? "redis://localhost:6379"
}

/** Enqueue an email job. Never throws — a broken queue must not fail the request. */
export async function pushEmailJob(job: {
  to: string
  template: TemplateName
  context: { code: string }
  subject: string
}): Promise<void> {
  const c = createQueueClient(getQueueUrl())
  try {
    await connect(c)
    await c.lPush(QUEUE_KEY, JSON.stringify({ ...job, attempts: 0 }))
  } catch (error) {
    console.error("[queue] failed to enqueue email job", error)
  } finally {
    if (c.isOpen) await c.quit().catch(() => undefined)
  }
}

export function createQueue(redisUrl: string): {
  push(job: Omit<EmailJob, "attempts">): Promise<void>
  pop(timeoutMs: number): Promise<{ job: EmailJob; raw: string } | null>
  ack(raw: string): Promise<void>
  retry(raw: string, job: EmailJob): Promise<void>
  recover(): Promise<number>
} {
  const client = createQueueClient(redisUrl)

  return {
    async push(job) {
      const c = await connect(client)
      await c.lPush(QUEUE_KEY, JSON.stringify({ ...job, attempts: 0 }))
    },

    async pop(timeoutMs) {
      const c = await connect(client)
      const raw = await c.brPopLPush(QUEUE_KEY, PROCESSING_KEY, Math.ceil(timeoutMs / 1000))
      if (!raw) return null
      return { job: JSON.parse(raw) as EmailJob, raw }
    },

    async ack(raw) {
      const c = await connect(client)
      await c.lRem(PROCESSING_KEY, 1, raw)
    },

    async retry(raw, job) {
      const c = await connect(client)
      await c.lRem(PROCESSING_KEY, 1, raw)
      const next: EmailJob = { ...job, attempts: job.attempts + 1 }
      await c.lPush(QUEUE_KEY, JSON.stringify(next))
    },

    async recover() {
      const c = await connect(client)
      const stale = await c.lRange(PROCESSING_KEY, 0, -1)
      if (stale.length === 0) return 0
      await c.lPush(QUEUE_KEY, stale)
      await c.del(PROCESSING_KEY)
      return stale.length
    },
  }
}
