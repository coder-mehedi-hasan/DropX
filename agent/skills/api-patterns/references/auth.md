# Auth — authentication & authorization

## Layers (separate concerns)

| Layer | Question |
| --- | --- |
| **AuthN** | Who is the caller? (session / JWT / API key) |
| **Tenant membership** | May they act in this org? |
| **Authorization** | May they run this **operation**? |
| **Entitlement** (optional) | Does the plan allow this feature? |

UI hiding buttons is **not** authorization.

## Policy catalog (recommended)

Maintain a map: `operationName → { public? | permissions[] | systemAdmin? | tenantRequired? }`.

- Unknown operations → deny.
- Public ops skip AuthN.
- Tenant-required ops fail closed without tenant context.
- Register every new mutation/query in the catalog when added.

```ts
const catalog: Record<string, OpPolicy> = {
  health: { public: true },
  invoiceCreate: { permissions: ["sale.invoice.create"], tenantRequired: true },
  adminUserList: { systemAdmin: true },
};
```

## Transport

- Extract identity + tenant in middleware/guards once.
- Pass `AuthContext` into services — services don’t parse cookies.
- Prefer one global guard/filter over copy-pasted checks in every handler (unless the surface has a different auth mode).

## Multi-surface

Merchant, storefront, and vendor APIs may use different AuthN adapters (JWT claims vs customer session) but share the same **fail-closed** mindset.

## Anti-patterns

- New op shipped without catalog/permission entry
- “Security” only in the frontend
- Mixing public and tenant-scoped behavior without explicit policy
- Trusting a client-sent `role` field
