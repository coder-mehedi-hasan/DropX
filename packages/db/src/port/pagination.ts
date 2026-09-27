import type { Id } from "./database";

/**
 * The single list contract for the whole platform.
 *
 * Every list endpoint in `apps/api` accepts this and answers with `Page<T>`.
 * Feature code must not invent a second pagination shape.
 */

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
/** Hard cap so a client cannot request the whole table. */
export const MAX_LIMIT = 100;

export type SortDirection = "asc" | "desc";

export const SORT_DIRECTIONS: readonly SortDirection[] = ["asc", "desc"] as const;

export function isSortDirection(value: unknown): value is SortDirection {
  return value === "asc" || value === "desc";
}

/** Raw, still-untrusted list input (query string). */
export type ListQuery = {
  page?: number | string | null;
  limit?: number | string | null;
  sortBy?: string | null;
  sort?: string | null;
  search?: string | null;
};

/** Validated list input, safe to hand to a repository. */
export type ListParams = {
  page: number;
  limit: number;
  sortBy?: string | undefined;
  sort: SortDirection;
  search?: string | undefined;
  offset: number;
};

export type PageMeta = {
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type Page<T> = {
  nodes: T[];
  meta: PageMeta;
};

function toPositiveInt(value: unknown, fallback: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  const int = Math.trunc(parsed);
  if (int < 1) return fallback;
  return Math.min(int, max);
}

export function normalizeListParams(query: ListQuery = {}): ListParams {
  const page = toPositiveInt(query.page, DEFAULT_PAGE, Number.MAX_SAFE_INTEGER);
  const limit = toPositiveInt(query.limit, DEFAULT_LIMIT, MAX_LIMIT);
  const sort = isSortDirection(query.sort) ? query.sort : "desc";
  const search = query.search?.trim();

  return {
    page,
    limit,
    offset: (page - 1) * limit,
    sort,
    sortBy: query.sortBy?.trim() || undefined,
    search: search ? search : undefined,
  };
}

export function buildPage<T>(nodes: T[], totalCount: number, params: ListParams): Page<T> {
  const totalPages = params.limit > 0 ? Math.ceil(totalCount / params.limit) : 0;

  return {
    nodes,
    meta: {
      totalCount,
      currentPage: params.page,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPreviousPage: params.page > 1 && totalPages > 0,
    },
  };
}

export function emptyPage<T>(params: ListParams): Page<T> {
  return buildPage<T>([], 0, params);
}

/** Offset/limit window rendered with vendor-neutral placeholders. */
export type PageWindow = {
  limit: number;
  offset: number;
};

export function toWindow(params: ListParams): PageWindow {
  return { limit: params.limit, offset: params.offset };
}

export type Identifiable = { id: Id };
