import type { SqlPrimitive } from "./database";
import type { ListParams, SortDirection } from "./pagination";

/**
 * Vendor-neutral SQL builder.
 *
 * Statements are emitted with `?` placeholders; the driver adapter translates
 * them to whatever its wire format needs. That is the only place a dialect
 * difference is allowed to appear.
 *
 * Identifiers are always literals, never bound values. Sort columns arrive
 * from the client, so `orderByListParams` enforces an allowlist before use.
 */

export type SortColumn = {
  column: string;
  direction?: SortDirection;
  /** Nullable columns need an explicit position or rows shuffle between pages. */
  nulls?: "first" | "last";
};

export type JoinType = "INNER" | "LEFT" | "RIGHT";

export type BuiltQuery = {
  sql: string;
  params: SqlPrimitive[];
};

type Clause = {
  text: string;
  params: SqlPrimitive[];
};

const ORDER_BY_DIRECTION: Record<SortDirection, string> = {
  asc: "ASC",
  desc: "DESC",
};

const ORDER_BY_NULLS: Record<NonNullable<SortColumn["nulls"]>, string> = {
  first: "NULLS FIRST",
  last: "NULLS LAST",
};

export class QueryBuilder {
  private columns = "*";
  private distinctOn = false;
  private table = "";
  private alias: string | undefined;
  private readonly joins: { type: JoinType; table: string; on: string; alias?: string }[] = [];
  private readonly predicates: Clause[] = [];
  private readonly havingClauses: Clause[] = [];
  private readonly groups: string[] = [];
  private readonly orders: string[] = [];
  private limitValue: number | undefined;
  private offsetValue: number | undefined;
  private forUpdate = false;

  select(columns: string): this {
    this.columns = columns;
    this.distinctOn = false;
    return this;
  }

  selectDistinct(columns: string): this {
    this.columns = columns;
    this.distinctOn = true;
    return this;
  }

  from(table: string, alias?: string): this {
    this.table = table;
    this.alias = alias;
    return this;
  }

  /**
   * `alias` is a third argument rather than part of `table` so callers keep
   * passing a real table name; self-joins and scope joins need a stable alias
   * that the `where` clauses can reference.
   */
  join(type: JoinType, table: string, on: string, alias?: string): this {
    this.joins.push({ type, table, on, alias });
    return this;
  }

  innerJoin(table: string, on: string, alias?: string): this {
    return this.join("INNER", table, on, alias);
  }

  leftJoin(table: string, on: string, alias?: string): this {
    return this.join("LEFT", table, on, alias);
  }

  /**
   * Appends an AND-ed predicate, binding params left to right.
   * A falsy clause is skipped, so `where("a = ?", maybe)` is safe.
   */
  where(condition: string | false | null | undefined, ...params: SqlPrimitive[]): this {
    if (!condition) return this;
    this.predicates.push({ text: condition, params });
    return this;
  }

  orWhere(condition: string, ...params: SqlPrimitive[]): this {
    if (!condition) return this;
    const last = this.predicates[this.predicates.length - 1];
    if (!last) return this.where(condition, ...params);

    this.predicates[this.predicates.length - 1] = {
      text: `(${last.text}) OR (${condition})`,
      params: [...last.params, ...params],
    };
    return this;
  }

  /** `column IN (...)`. An empty list becomes a false predicate, never `IN ()`. */
  whereIn(column: string, values: readonly SqlPrimitive[]): this {
    if (values.length === 0) return this.where("1 = 0");
    return this.where(`${column} IN (${placeholders(values.length)})`, ...values);
  }

  whereNotIn(column: string, values: readonly SqlPrimitive[]): this {
    if (values.length === 0) return this;
    return this.where(`${column} NOT IN (${placeholders(values.length)})`, ...values);
  }

  whereNull(column: string): this {
    return this.where(`${column} IS NULL`);
  }

  whereNotNull(column: string): this {
    return this.where(`${column} IS NOT NULL`);
  }

  whereBetween(column: string, from: SqlPrimitive, to: SqlPrimitive): this {
    return this.where(`${column} BETWEEN ? AND ?`, from, to);
  }

  /** Case-insensitive contains across already-allowlisted columns. */
  whereSearch(value: string | undefined, columns: readonly string[]): this {
    if (!value || columns.length === 0) return this;
    const like = `%${escapeLike(value)}%`;
    return this.where(
      `(${columns.map((column) => `${column} LIKE ?`).join(" OR ")})`,
      ...columns.map(() => like),
    );
  }

  groupBy(...columns: string[]): this {
    this.groups.push(...columns);
    return this;
  }

  /**
   * Emitted after GROUP BY, not folded into WHERE — aliasing an aggregate in
   * WHERE is invalid in MySQL and silently changes the result set.
   */
  having(condition: string, ...params: SqlPrimitive[]): this {
    this.havingClauses.push({ text: condition, params });
    return this;
  }

  /** Pass only allowlisted columns — `sortBy` originates from the client. */
  orderBy(columns: readonly SortColumn[]): this {
    for (const { column, direction = "asc", nulls } of columns) {
      const clause = `${column} ${ORDER_BY_DIRECTION[direction]}` + (nulls ? ` ${ORDER_BY_NULLS[nulls]}` : "");
      this.orders.push(clause);
    }
    return this;
  }

  /**
   * Applies `sortBy`/`sort` when the column passed the allowlist, otherwise
   * `fallback`. Falls back entirely also when sorting on the fallback would
   * contradict an explicit filter-driven order, so callers stay in control.
   */
  orderByListParams(
    params: ListParams,
    allowed: readonly string[],
    fallback: readonly SortColumn[],
  ): this {
    const requested = params.sortBy && allowed.includes(params.sortBy) ? params.sortBy : undefined;
    const columns: SortColumn[] = requested
      ? [{ column: requested, direction: params.sort }, ...fallback]
      : [...fallback];
    return this.orderBy(columns);
  }

  limit(limit: number): this {
    this.limitValue = Math.max(0, Math.trunc(limit));
    return this;
  }

  offset(offset: number): this {
    this.offsetValue = Math.max(0, Math.trunc(offset));
    return this;
  }

  lockForUpdate(): this {
    this.forUpdate = true;
    return this;
  }

  build(): BuiltQuery {
    if (!this.table) throw new Error("QueryBuilder.build() requires from()");

    const params: SqlPrimitive[] = [];
    let sql = "SELECT ";
    if (this.distinctOn) sql += "DISTINCT ";
    sql += `${this.columns} FROM ${this.table}`;
    if (this.alias) sql += ` AS ${this.alias}`;

    for (const join of this.joins) {
      sql += ` ${join.type} JOIN ${join.table}`;
      if (join.alias) sql += ` AS ${join.alias}`;
      sql += ` ON ${join.on}`;
    }
    if (this.predicates.length > 0) {
      sql += " WHERE ";
      sql += this.predicates
        .map((predicate) => {
          params.push(...predicate.params);
          return `(${predicate.text})`;
        })
        .join(" AND ");
    }
    if (this.groups.length > 0) sql += ` GROUP BY ${this.groups.join(", ")}`;
    if (this.havingClauses.length > 0) {
      sql += " HAVING ";
      sql += this.havingClauses
        .map((clause) => {
          params.push(...clause.params);
          return `(${clause.text})`;
        })
        .join(" AND ");
    }
    if (this.orders.length > 0) sql += ` ORDER BY ${this.orders.join(", ")}`;
    if (this.limitValue !== undefined) sql += ` LIMIT ${this.limitValue}`;
    if (this.offsetValue !== undefined) sql += ` OFFSET ${this.offsetValue}`;
    if (this.forUpdate) sql += " FOR UPDATE";

    return { sql, params };
  }

  /** Same projection and filters, no ordering or window — feeds `Executor.count`. */
  buildCount(): BuiltQuery {
    // The ORDER BY clauses are copied, not just counted: assigning back to
    // `orders.length` would pad the cleared array with holes.
    const saved = {
      columns: this.columns,
      orders: [...this.orders],
      limit: this.limitValue,
      offset: this.offsetValue,
      forUpdate: this.forUpdate,
    };

    this.columns = "COUNT(*)";
    this.distinctOn = false;
    this.orders.length = 0;
    this.limitValue = undefined;
    this.offsetValue = undefined;
    this.forUpdate = false;

    const count = this.build();

    this.columns = saved.columns;
    this.orders.length = 0;
    this.orders.push(...saved.orders);
    this.limitValue = saved.limit;
    this.offsetValue = saved.offset;
    this.forUpdate = saved.forUpdate;

    return count;
  }
}

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/** `?, ?, ?` — for building `IN` lists by hand. */
export function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

/** Values for an `INSERT`/`UPDATE`; `undefined` means "leave the column alone". */
export type ColumnValues = Record<string, SqlPrimitive | undefined>;

export class InsertBuilder {
  private readonly columns: string[] = [];
  private readonly values: SqlPrimitive[] = [];

  constructor(
    private readonly table: string,
    data: ColumnValues,
  ) {
    for (const [column, value] of Object.entries(data)) {
      if (value === undefined) continue;
      this.columns.push(column);
      this.values.push(value);
    }
  }

  get isEmpty(): boolean {
    return this.columns.length === 0;
  }

  build(): BuiltQuery {
    return {
      sql: `INSERT INTO ${this.table} (${this.columns.join(", ")}) VALUES (${placeholders(
        this.columns.length,
      )})`,
      params: this.values,
    };
  }
}

export class UpdateBuilder {
  private readonly assignments: string[] = [];
  private readonly values: SqlPrimitive[] = [];
  private scope: Clause | undefined;

  constructor(
    private readonly table: string,
    data: ColumnValues,
  ) {
    for (const [column, value] of Object.entries(data)) {
      if (value === undefined) continue;
      this.assignments.push(`${column} = ?`);
      this.values.push(value);
    }
  }

  get isEmpty(): boolean {
    return this.assignments.length === 0;
  }

  /**
   * Always required. Callers must pass a scope predicate that includes the
   * tenant/branch/owner column — an unscoped UPDATE is a review blocker.
   */
  where(condition: string, ...params: SqlPrimitive[]): this {
    this.scope = { text: condition, params };
    return this;
  }

  build(): BuiltQuery | null {
    if (this.isEmpty) return null;
    if (!this.scope) {
      throw new Error("UpdateBuilder.build() requires where() — refusing to write an unscoped UPDATE");
    }
    return {
      sql: `UPDATE ${this.table} SET ${this.assignments.join(", ")} WHERE ${this.scope.text}`,
      params: [...this.values, ...this.scope.params],
    };
  }
}
