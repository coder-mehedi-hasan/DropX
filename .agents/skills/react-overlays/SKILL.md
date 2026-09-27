---
name: react-overlays
description: >-
  React overlays — FormSheetShell + useFormSheetState, remount keys,
  useConfirmation for deletes, sheet open as local state. Use when adding
  create/edit sheets, dialogs, or choosing sheet vs route.
---

# React Overlays

Parent: `react-patterns`. Forms: `react-forms`. Full samples: [overlays.md](../react-patterns/references/overlays.md).

## Decision tree

| Need | Prefer |
| --- | --- |
| Simple create/edit on a list | `FormSheetShell` |
| Destructive | `useConfirmation` |
| Long / multi-section form | Full-page route |
| Shareable URL | Route |

## FormSheetShell

```tsx
const { formId, isSubmitting, formProps } = useFormSheetState();

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
```

- Footer submits via `form={formId}`; form uses `hideSubmit: true`.
- Remount `key` when mode/entity/open changes.
- Form calls `onPendingChange` while mutating.

## Confirm delete

```tsx
confirm({
  title: "Delete product?",
  description: `Delete "${product.title}"? This cannot be undone.`,
  variant: "destructive",
  onConfirm: () => removeMutation.mutate(product._id),
});
```

## Anti-patterns

- Route navigation for tiny edits
- Sheet-open in the URL for routine CRUD
- Delete without confirm
- Missing remount `key` (stale form)

## Done checklist

- [ ] Sheet vs route matches complexity
- [ ] `FormSheetShell` + remount `key`
- [ ] Confirm before destructive
- [ ] Open state not in URL (unless deep-link required)
