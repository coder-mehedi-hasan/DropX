# Overlays — sheets + confirms

## Decision tree

| Need | Prefer |
| --- | --- |
| Create/edit while keeping list context | `FormSheetShell` (side sheet) |
| Destructive / irreversible | `useConfirmation()` dialog |
| Long multi-section / wizard | Full-page route (+ `FloatingFormActions` if needed) |
| Light read-only detail | View sheet or detail route |
| Must be shareable URL | Route |

List page/sort/search stay in the **URL**. Sheet open + editing entity stay in **component state**.

## Form sheets

```tsx
export function CustomerFormSheet({ open, onOpenChange, mode, customer, onSuccess }) {
  const { formId, isSubmitting, formProps } = useFormSheetState();
  const isUpdate = mode === "update";

  return (
    <FormSheetShell
      open={open}
      onOpenChange={onOpenChange}
      title={isUpdate ? "Edit customer" : "Create customer"}
      formId={formId}
      submitLabel={isUpdate ? "Save changes" : "Create customer"}
      isSubmitting={isSubmitting}
    >
      <CustomerForm
        key={`${mode}-${customer?._id ?? "new"}-${open ? "open" : "closed"}`}
        mode={mode}
        customer={customer}
        onSuccess={onSuccess}
        onClose={() => onOpenChange(false)}
        {...formProps}
      />
    </FormSheetShell>
  );
}
```

`useFormSheetState()`:

```tsx
function useFormSheetState() {
  const formId = useId();
  const [isSubmitting, setIsSubmitting] = useState(false);
  return {
    formId,
    isSubmitting,
    formProps: {
      formId,
      hideSubmit: true as const,
      onPendingChange: setIsSubmitting,
    },
  };
}
```

Rules:

- Footer submit uses `form={formId}`; form hides its own button (`hideSubmit`).
- Remount with `key` when switching create ↔ entity (and preferably open/closed).
- Form reports pending via `onPendingChange`.
- Thin `*-form-sheet.tsx` wrappers; fat form lives in feature `components/`.

## Confirm before destructive

```tsx
confirm({
  title: "Delete product?",
  description: `Delete "${product.title}"? This cannot be undone.`,
  variant: "destructive",
  onConfirm: () => {
    clearServerErrors();
    removeMutation.mutate(product._id);
  },
});
```

List mutation `onError` → `setServerError` → `ServerFormError` above the table (sheet/list stays usable).

## Focus / a11y

Prefer the design-system Sheet/Dialog (focus trap + Esc). Restore focus to the trigger on close.

## Anti-patterns

- Navigating to a new route for a 3-field edit
- Encoding “sheet open” in the URL for routine CRUD
- Destructive delete with no confirm
- Forgetting remount `key` / hydrate (stale create/edit data)
