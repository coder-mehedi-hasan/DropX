/**
 * Email queue.
 *
 * Fire-and-forget jobs pushed to a Redis list. A background worker pops them
 * and delivers via the transport. Decoupling means:
 *   - the request handler never waits on SMTP, so a slow provider cannot stall
 *     an OTP request,
 *   - a failed send is retried by the worker rather than killing the caller.
 *
 * The queue is a plain list (LPUSH / BRPOP) — no external broker needed.
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

let client: RedisClientType | undefined

async function ensureClient(url: string): Promise<RedisClientType> {
  if (client) return client
  client = createClient({ url })
  client.on("error", (error) => console.error("[queue] redis error", error))
  await client.connect()
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
  try {
    const c = await ensureClient(getQueueUrl())
    await c.lPush(QUEUE_KEY, JSON.stringify({ ...job, attempts: 0 }))
  } catch (error) {
    console.error("[queue] failed to enqueue email job", error)
  }
}

export function createQueue(redisUrl: string): {
  push(job: Omit<EmailJob, "attempts">): Promise<void>
  pop(timeoutMs: number): Promise<EmailJob | null>
  retry(job: EmailJob): Promise<void>
} {
  return {
    async push(job) {
      const c = await ensureClient(redisUrl)
      await c.lPush(QUEUE_KEY, JSON.stringify({ ...job, attempts: 0 }))
    },

    async pop(timeoutMs) {
      const c = await ensureClient(redisUrl)
      const result = await c.brPop(QUEUE_KEY, Math.ceil(timeoutMs / 1000))
      if (!result) return null
      return JSON.parse(result.element) as EmailJob
    },

    async retry(job) {
      const c = await ensureClient(redisUrl)
      const next: EmailJob = { ...job, attempts: job.attempts + 1 }
      await c.lPush(QUEUE_KEY, JSON.stringify(next))
    },
  }
}
