/**
 * Background job queue.
 *
 * BullMQ on Redis, shared by every feature that needs work moved off the request
 * path. A feature calls `enqueue` to publish and registers a processor to
 * consume; `startJobQueueProcessor()` starts everything registered.
 *
 * Retries, backoff, stalled-job recovery and per-job locking are BullMQ's job.
 */
import { Queue, Worker, type ConnectionOptions, type JobsOptions } from "bullmq"

import { getConfig } from "../../config"

/** Applied to every queue unless a job overrides them. */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2_000 },
  removeOnComplete: 1_000,
  removeOnFail: 5_000,
}

/**
 * `enableOfflineQueue: false` makes a command fail fast while the socket is down
 * instead of buffering it. Without it `enqueue` would hang the request trying to
 * publish — the failure mode this module exists to avoid.
 */
function connection(): ConnectionOptions {
  return { url: getConfig().redis.url, enableOfflineQueue: false }
}

const queues = new Map<string, Queue>()

/**
 * Publish a job. Never throws — a broken queue must not fail the request that
 * triggered it, which is the entire reason the work was queued in the first place.
 */
export async function enqueue<T>(queue: string, data: T): Promise<void> {
  try {
    let handle = queues.get(queue)
    if (!handle) {
      handle = new Queue(queue, {
        connection: connection(),
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      })
      // BullMQ queues are EventEmitters: an unhandled `error` takes the process
      // down, so a Redis outage logs here instead of killing the API.
      handle.on("error", (error) => console.error(`[queue:${queue}] error`, error))
      queues.set(queue, handle)
    }
    await handle.add("default", data)
  } catch (error) {
    console.error(`[queue:${queue}] failed to enqueue job`, error)
  }
}

/**
 * Close the producers this process opened.
 *
 * BullMQ holds a live Redis connection, so a short script that enqueues would
 * otherwise never exit. Harmless to call from the API, which serves regardless.
 */
export async function closeQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((queue) => queue.close()))
  queues.clear()
}

/**
 * Start processing a queue. Called once per queue at startup.
 *
 * Registering starts the processor immediately — there is no separate "start
 * everything" step to forget. Throwing from `process` retries the job per
 * `DEFAULT_JOB_OPTIONS`, and both the retry and the terminal failure are logged
 * here, so a feature only has to describe *what* it processes.
 */
export function registerJobProcessor<T>(queue: string, process: (data: T) => Promise<void>): void {
  const processor = new Worker(queue, (job) => process(job.data as T), {
    connection: connection(),
    concurrency: 5,
  })

  processor.on("error", (error) => console.error(`[processor:${queue}] error`, error))
  processor.on("failed", (job, error) => {
    const attempts = job?.opts.attempts ?? 1
    const made = job?.attemptsMade ?? attempts
    console.error(
      made >= attempts
        ? `[processor:${queue}] job permanently failed after ${made} attempts`
        : `[processor:${queue}] job failed (attempt ${made}), retrying`,
      error,
    )
  })

  console.info(`[processor:${queue}] started`)
}
