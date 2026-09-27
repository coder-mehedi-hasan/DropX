import { buildPage, normalizeListParams, type Executor, type ListParams, type Page, type QueryBuilder } from "@dropx/db";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * One list contract for the whole API.
 *
 * Request:  `?page=1&limit=20&sortBy=createdAt&sort=desc&search=...`
 * Response: `{ nodes, meta }` — never a bare array, never a per-feature shape.
 */

export type ListQueryInput = {
  page?: string | undefined;
  limit?: string | undefined;
  sortBy?: string | undefined;
  sort?: string | undefined;
  search?: string | undefined;
};

export function parseListQuery(input: ListQueryInput): ListParams {
  return normalizeListParams(input);
}

/**
 * Runs a count and a page window concurrently against the same filters.
 *
 * The builder must already carry its allowlisted ordering and filters; this
 * function only adds the window, so a list endpoint cannot accidentally ship an
 * unbounded query.
 */
export async function runPaginated<T>(
  db: Executor,
  builder: QueryBuilder,
  params: ListParams,
): Promise<Page<T>> {
  const countQuery = builder.buildCount();
  const pageQuery = builder.limit(params.limit).offset(params.offset).build();

  const [count, rows] = await Promise.all([
    db.count(countQuery.sql, countQuery.params),
    db.query<T>(pageQuery.sql, pageQuery.params),
  ]);

  return buildPage(rows.rows, count, params);
}

export function okPage<T>(page: Page<T>, status: ContentfulStatusCode = 200): Response {
  return Response.json(page, { status });
}
