# Data ops — API calls, cache, and errors

Transport-agnostic (`fetch`, GraphQL, …). Prefer success toast; server failures in a top banner.

## API calling contract

1. **Request throws on failure** — don’t soft-return `{ ok: false }`.
2. **`useMutation` / `useQuery`** — don’t swallow in `mutationFn`; let `onError` run.
3. **Map / trim input** before send.
4. **On success:** `AppToast.success` → close sheet (if any) → parent `onSuccess` / refetch or invalidate.
5. **On error:** `setServerError(error, fallback)` → **top banner** → keep sheet/page open. **Do not** toast API errors.

```tsx
const createMutation = useMutation({
  mutationFn: (input: CustomerInput) => createCustomer(input),
  // fetch / gqlRequest inline in mutationFn is fine
  onSuccess: () => {
    AppToast.success("Customer created");
    onClose();
    onSuccess(); // e.g. void query.refetch()
  },
  onError: (error: unknown) => {
    setServerError(error, "Failed to create customer");
  },
});

clearServerErrors();
createMutation.mutate(parsed.data);
```

```tsx
// AppToast — success / info only
// Server/API failures → ServerFormError via useServerErrors
```

---

## Transport samples

### `fetch`

```ts
async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.message ?? body.error ?? res.statusText;
  } catch {
    return res.statusText || "Request failed";
  }
}

export async function createCustomer(input: CustomerInput) {
  const res = await fetch("/api/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<{ id: string }>;
}
```

### GraphQL

```ts
export async function createSupplier(values: SupplierFormValues) {
  const input = {
    name: values.name,
    contact_person: values.contact_person?.trim() || undefined,
    is_active: values.is_active,
  };

  const data = await gqlRequest<
    { inventory__createSupplier: { id: string } },
    { input: typeof input }
  >({
    query: CREATE_SUPPLIER_MUTATION,
    variables: { input },
  });

  return data.inventory__createSupplier;
}
```

Multi-tenant list queries often use `queryKey: [resource, tenant, where]`.

---

## Server errors on top

**First child** of `<form>` (or above the list toolbar for page-level failures).

```tsx
const { serverErrors, clearServerErrors, setServerError } = useServerErrors(
  "Failed to save customer",
);

<form id={formId} onSubmit={handleSubmit} noValidate>
  <ServerFormError
    errors={serverErrors}
    title="Unable to save customer"
    onDismiss={clearServerErrors}
  />
  {formErrors.length > 0 ? <FormError errors={formErrors} /> : null}
  {/* fields */}
</form>
```

`setServerError` should run through a user-facing formatter (strip technical noise; keep business messages).

---

## Cache keys

```
[resource, ...scope, ...params]
```

Invalidate by resource prefix, or `query.refetch()` from the sheet `onSuccess`.

```tsx
useQuery({
  queryKey: ["customers", tenant, where],
  queryFn: () => listCustomers({ tenant, where }),
});
```

---

## Anti-patterns

- Swallowing errors in `mutationFn`
- Toast-only for form/list API failures
- Banner below fields
- Closing overlay in `onError`
