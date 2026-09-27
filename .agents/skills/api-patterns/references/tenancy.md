# Tenancy — scope every query

## Contract

1. **Org/tenant id comes from auth context** (header claim, JWT, session) — not from an untrusted body field alone.
2. **Every read and write** of tenant-owned data includes that scope in the query/filter.
3. **Creates stamp** the tenant from context.
4. **Missing tenant** on merchant/customer/vendor paths → deny (401/403), don’t silently query globally.
5. **Wrong tenant** → not found / empty (no cross-tenant leak).

```ts
type AuthContext = {
  userId: string;
  tenantId?: string; // required on tenant-scoped surfaces
  roles?: string[];
};

function scopedFilter<T extends { tenantId?: string }>(
  filter: T,
  tenantId: string,
): T & { tenantId: string } {
  return { ...filter, tenantId };
}

// List
repo.findMany(scopedFilter(clientFilters, ctx.tenantId!));

// Single / update / delete
repo.findOne({ id, tenantId: ctx.tenantId! });
repo.update({ id, tenantId: ctx.tenantId! }, patch);

// Create
repo.create({ ...input, tenantId: ctx.tenantId! });
```

## Platform / admin surfaces

Admin or system operators may omit tenant **only** when the auth policy explicitly allows global scope. Document those ops. Never reuse the “optional tenant” helper on merchant APIs without a guard.

## Multi-surface APIs

| Surface | Typical scope source |
| --- | --- |
| Merchant console API | Tenant header / membership + JWT |
| Customer storefront API | Tenant + customer identity |
| Vendor API | Vendor id (+ tenant) from JWT claims |

Same principle — different claim names. Always bind scope in the query.

## Anti-patterns (blockers)

- `findById(id)` with no tenant/vendor/customer predicate
- Accepting `tenantId` from the client body as the sole scope
- Filter helpers that **no-op** when tenant is empty on merchant routes
- Returning another tenant’s row with a generic 200
