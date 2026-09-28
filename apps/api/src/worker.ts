/**
 * Worker entry point.
 *
 * Long-lived process that drains the email queue. Run alongside the API:
 *   bun run --cwd apps/api worker
 *
 * The API itself stays request-focused — handlers enqueue, the worker
 * delivers. This keeps a slow/broken SMTP provider from stalling requests.
 */
import { runEmailWorker } from "./shared/email/worker"

runEmailWorker()
