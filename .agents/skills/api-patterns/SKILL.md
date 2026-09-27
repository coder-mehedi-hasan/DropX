---
name: api-patterns
description: >-
  Framework-agnostic API guideline — feature co-location, tenancy scoping,
  validated inputs, list pagination contract, thin transport, structured
  domain errors, auth policies, side effects after write. Use when building
  or reviewing backend features, resolvers, controllers, services, or DTOs.
---

# API Patterns

Portable backend contracts. Prefer the host framework’s existing kit. Nest/GraphQL/Mongoose/etc. appear only under [references/adapters.md](references/adapters.md) — not as requirements.

## Pattern map

| Pattern | Use when | Deep dive |
| --- | --- | --- |
| Layout | Feature folders, layers | [references/layout.md](references/layout.md) · `api-modules` |
| Tenancy | Multi-tenant reads/writes | [references/tenancy.md](references/tenancy.md) |
| Validation | Inputs vs domain | [references/validation.md](references/validation.md) |
| Lists | Pagination + filters | [references/pagination.md](references/pagination.md) |
| Auth | AuthN / AuthZ boundaries | [references/auth.md](references/auth.md) |
| Errors | Domain codes → client | [references/errors.md](references/errors.md) |
| Side effects | Mail, queues, events | [references/side-effects.md](references/side-effects.md) |
| Review | PR / module audit | `api-review` |

## Core principles

1. **Co-locate features** — transport + application + local inputs in one feature folder; shared domain models live outside transport.
2. **Tenancy from auth context** — never trust client-supplied org/tenant alone; scope every merchant/customer/vendor query.
3. **Validate at the boundary** — input DTOs ≠ domain entities; whitelist unknowns.
4. **One list contract** — page/limit/sort/filters in → `{ nodes, meta }` (or host equivalent) out.
5. **Thin transport** — controllers/resolvers map args and delegate; business rules live in services.
6. **Structured domain errors** — stable `code` + user `message`; don’t flatten into opaque strings.
7. **AuthZ is policy-driven** — catalog/map of operation → permissions; UI hiding is not security.
8. **Side effects after durable write** — enqueue/emit after success; don’t fail the primary mutation on mail/queue unless product requires sync delivery.

## Mini example (shape)

```ts
// Transport — thin
async function listInvoices(ctx: AuthContext, query: ListQuery) {
  assertTenant(ctx);
  return invoiceService.list(scopedListQuery(query, ctx.tenantId));
}

// Application — rules + scope
async function updateStatus(ctx: AuthContext, id: string, status: Status) {
  const invoice = await repo.findOne({ id, tenantId: ctx.tenantId });
  if (!invoice) throw domainError("NOT_FOUND", "Invoice not found");
  // ... business rules ...
  const saved = await repo.update({ id, tenantId: ctx.tenantId }, { status });
  notificationQueue.enqueue({ type: "INVOICE_UPDATED", id }); // after write
  return saved;
}
```

## Anti-patterns

- findById / update without tenant (or equivalent) predicate
- Trusting `tenantId` from the request body for scoping
- Fat resolvers/controllers with DB + business logic
- Catch-all `catch { throw BadRequest(error.message) }` that drops error codes
- Per-feature pagination response shapes
- New operations without permission/catalog registration
- Sync third-party I/O on the critical path that can fail the write after commit ambiguity

## Adapters

Optional Nest/GraphQL/Mongoose mappings: [references/adapters.md](references/adapters.md).
