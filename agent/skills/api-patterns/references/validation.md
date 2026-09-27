# Validation — inputs vs domain

## Contract

| Artifact | Role |
| --- | --- |
| **Input DTO** | Shape + validation for create/update/list from the client |
| **Domain / entity** | Persistence and (when shared) public model |
| **Command / result** | Optional internal types for service methods |

- Validate **at the transport boundary** (schema, class-validator, Zod, etc.).
- **Whitelist** — reject unknown fields unless explicitly allowed.
- Map input → domain in the service (trim, defaults, stamp tenant).
- Don’t put transport validators on shared entity classes if that couples packages to one framework.

```ts
// Input — validated
type CreateInvoiceInput = {
  customerId: string;
  lines: { productId: string; quantity: number; unitPrice: number }[];
  notes?: string;
};

// Service maps + stamps
async function create(ctx: AuthContext, input: CreateInvoiceInput) {
  const parsed = createInvoiceSchema.parse(input); // or framework pipe
  return repo.create({
    ...parsed,
    tenantId: ctx.tenantId!,
    status: "draft",
  });
}
```

## Rules of thumb

- Required strings: reject empty/whitespace.
- Numbers/booleans: coerce only with an explicit schema (query strings are strings).
- Enums: shared domain enum, validated on input.
- Never trust client for: `tenantId`, `role`, `isAdmin`, prices you must recompute, etc.

## Anti-patterns

- `any` / untyped bodies on mutations
- Reusing the full entity type as the create input (leaks internal fields)
- Validating only in the UI
