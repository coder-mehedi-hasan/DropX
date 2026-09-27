# Side effects — after the write

## Contract

1. **Persist first** (create/update/delete succeeds).
2. **Then** enqueue mail, notifications, webhooks, analytics, or emit domain events.
3. Side-effect failures should **not** undo a successful commit unless the product requires synchronous delivery (document those rare cases).
4. Handlers/listeners own external I/O; services stay readable.

```ts
const saved = await repo.update(scope, patch);

// Fire-and-forget / queue — isolate failures
mailQueue.enqueue({
  template: "invoice-paid",
  to: saved.customerEmail,
  data: { id: saved.id },
});

events.emit("invoice.updated", { id: saved.id, tenantId: ctx.tenantId });
```

## Transactions

If multiple documents must commit atomically, use an explicit unit-of-work / transaction API. Sequential “update A then B” without a transaction is **eventual** — document it.

Don’t start a transaction around slow external HTTP calls.

## Anti-patterns

- Sending SMTP/HTTP inside the request path such that a provider outage fails a DB write the user already thinks succeeded (or the reverse chaos)
- Emitting events **before** the write commits
- Swallowing queue errors silently with no log/metric
