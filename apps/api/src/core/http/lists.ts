import { normalizeListParams, type ListParams, type Page } from "../../db/models"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { response } from "./responses"

/**
 * One list contract for the whole API.
 *
 * Request:  `?page=1&limit=20&sortBy=createdAt&sort=desc&search=...`
 * Response: `{ nodes, meta }` — never a bare array, never a per-feature shape.
 */

export type ListQueryInput = {
  page?: string | undefined
  limit?: string | undefined
  sortBy?: string | undefined
  sort?: string | undefined
  search?: string | undefined
}

export function parseListQuery(input: ListQueryInput): ListParams {
  return normalizeListParams(input)
}

/**
 * Success response for a paginated list: `{ nodes, meta }`.
 */
export function okPage<T>(page: Page<T>, status: ContentfulStatusCode = 200): Response {
  return Response.json(response.success(page, status), { status })
}
