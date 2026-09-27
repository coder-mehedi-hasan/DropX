import type { Context, MiddlewareHandler, Next } from "hono";
import { createMiddleware } from "hono/factory";

import { ERROR_CODES, DomainError } from "../../core/errors";
import type { AppEnv } from "../../types/env";
import type { Audience } from "./auth-context";
import { assertActiveCustomer, assertAudience, assertPermissions } from "./middleware";

/**
 * Policy catalog.
 *
 * Every route declares its operation here, and `defineOperation` both registers
 * it and enforces it. That is deliberate: a separate hand-maintained catalog
 * drifts from the routes, and a route that is missing from the catalog is
 * exactly the "new op shipped without a policy entry" blocker from `api-review`.
 *
 * Rules enforced at boot and per request:
 *   - unknown/absent policy  -> 401 (fail closed)
 *   - public ops             -> no token needed
 *   - audience mismatch      -> 401 (a console token cannot call rider routes)
 *   - missing permission     -> 403 with the missing keys
 *   - TEMP customer          -> 403 on portal operations
 */

export type OperationPolicy = {
  /** Stable operation name, e.g. `parcel.list`. */
  id: string;
  public?: boolean;
  /** Which app may call it. Omit to allow any authenticated app. */
  audience?: Audience[];
  /** All-of semantics: the actor needs every key. Use `anyOf` for alternatives. */
  permissions?: string[];
  anyOf?: string[];
  /** Customers must be ACTIVE (OTP verified). */
  requiresActiveCustomer?: boolean;
};

export type CatalogEntry = OperationPolicy & {
  method: string;
  path: string;
};

const catalog = new Map<string, CatalogEntry>();

function register(entry: CatalogEntry): void {
  const existing = catalog.get(entry.id);
  if (existing) {
    throw new Error(
      `Duplicate operation id "${entry.id}" (${existing.method} ${existing.path} vs ${entry.method} ${entry.path})`,
    );
  }
  catalog.set(entry.id, entry);
}

/** Builds the enforcing middleware and records the operation in the catalog. */
export function defineOperation(
  policy: OperationPolicy,
  route: { method: string; path: string },
): MiddlewareHandler<AppEnv> {
  register({ ...policy, ...route });

  return createMiddleware<AppEnv>(async (c: Context<AppEnv>, next: Next) => {
    c.set("operationId", policy.id);

    if (!policy.public) {
      const { actor } = c.get("auth");
      if (actor.kind === "public") {
        throw new DomainError(ERROR_CODES.UNAUTHENTICATED, "Please sign in to continue");
      }
    }

    if (policy.audience) assertAudience(c, policy.audience);
    if (policy.permissions) assertPermissions(c, policy.permissions);

    if (policy.anyOf) {
      const { actor } = c.get("auth");
      const granted =
        actor.kind === "staff" || actor.kind === "rider" ? actor.permissions : new Set<string>();
      if (!policy.anyOf.some((key) => granted.has(key))) {
        throw new DomainError(
          ERROR_CODES.MISSING_PERMISSION,
          "You do not have permission to perform this action",
        );
      }
    }

    if (policy.requiresActiveCustomer) assertActiveCustomer(c);

    await next();
  });
}

export function getPolicyCatalog(): ReadonlyMap<string, CatalogEntry> {
  return catalog;
}

export function findPolicy(id: string): CatalogEntry | undefined {
  return catalog.get(id);
}

/** Startup self-check: the catalog must not be empty and ids must be namespaced. */
export function assertPolicyCatalog(): void {
  if (catalog.size === 0) {
    throw new Error("Policy catalog is empty — no operations registered");
  }

  for (const id of catalog.keys()) {
    if (!/^[a-z][a-zA-Z]*\.[a-zA-Z]+$/.test(id)) {
      throw new Error(`Operation id "${id}" must look like "{domain}.{action}"`);
    }
  }
}
