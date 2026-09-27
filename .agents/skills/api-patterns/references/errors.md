# Errors — structured domain failures

## Contract

Throw (or return) a **domain error** with:

- **`code`** — stable machine token (`NOT_FOUND`, `ALREADY_EXISTS`, `ROLE_IN_USE`, …)
- **`message`** — safe human string for UI banners

```ts
class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// Service
if (!role) throw new DomainError("NOT_FOUND", "Role not found");
if (inUse) {
  throw new DomainError(
    "ROLE_IN_USE",
    "You can't delete this role because some users already have it.",
  );
}
```

## Transport rules

- Map `DomainError` → HTTP/GraphQL error **preserving `code`** (extensions / body).
- **Do not** wrap as `BadRequest(error.message)` if that drops the code.
- Unexpected errors → generic message + log correlation id; never stack traces to clients.

## Client pairing

Frontends show `message` in a top-of-form / page banner (`ServerFormError`); map `code` when special UX is needed. Success toasts only — see frontend `react-forms` / data-ops.

## Anti-patterns

- `catch (e) { throw new BadRequestException(e.message) }` everywhere
- Throwing raw driver errors to clients
- Using the same 400 for not-found and validation without codes
- Leaking internal JSON blobs as `message`
