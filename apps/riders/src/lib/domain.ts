/**
 * Domain types the API returns. The shared shapes (statuses, entities,
 * pagination, rider jobs) come from `@dropx/types` — the single source of truth
 * the API writes to and every other app reads from, so the parcel status list
 * can be extended in one place and break the build everywhere that has not
 * handled it.
 */

export type { DeliveryStatus, Job, JobDetail, PageMeta, Page } from "@dropx/types"
