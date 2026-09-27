# React hygiene (short)

## Prefer derivation over sync effects

If a value can be computed from props/state during render, don’t mirror it into state with `useEffect`.

```tsx
// ❌ sync effect
const [fullName, setFullName] = useState("");
useEffect(() => {
  setFullName(`${user.firstName} ${user.lastName}`);
}, [user.firstName, user.lastName]);

// ✅ derive during render
const fullName = `${user.firstName} ${user.lastName}`;
```

## Effects have a reason

Valid: subscribe, connect to an external system, reset form when overlay opens. Invalid: “keep A in sync with B” when A is derivable.

```tsx
// ✅ external system / intentional reset
useEffect(() => {
  if (!open) return;
  form.reset(entity ? toValues(entity) : emptyValues());
}, [open, entity, form]);
```

## State ownership

- Server list inputs → URL
- Ephemeral UI (overlay open, local tab) → component state
- Remote entities → server-state library or explicit fetch — not duplicated into a second client store without need

```tsx
const sp = parseListSearchParams(searchParams); // list inputs
const [sheetOpen, setSheetOpen] = useState(false); // ephemeral UI
const { data } = useQuery({ queryKey: ["invoices", sp], queryFn: () => listInvoices(sp) });
```

## Context

Use context for ambient dependencies (theme, auth session handle, i18n). Don’t use context as a dumping ground for feature business state that only one subtree needs — lift state or colocate a hook instead.

## Shared components

Don’t extract to a global `components/` folder for a single consumer. Start next to the feature; promote only when reuse is real.

Once shared: **open/closed** — extend by wrapping/composing (`className`, `children`, slots); don’t edit the shared file for one screen. See [components.md](components.md).

## Lists and keys

Stable `key`s from entity ids. Avoid index keys when the list can reorder, filter, or paginate.

```tsx
{invoices.map((invoice) => (
  <InvoiceRow key={invoice.id} invoice={invoice} />
))}
```

## Perf (only when measured)

- Don’t default to `memo` / `useMemo` / `useCallback` everywhere.
- Virtualize only long lists that actually jank.
- Split code at route/feature boundaries when bundles are large — not every component.
