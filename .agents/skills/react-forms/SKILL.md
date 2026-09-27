---
name: react-forms
description: >-
  Schema-first React forms — useState + Zod safeParse + FormField* +
  ServerFormError + FormSheetShell. RHF Controllers as alternate. Use when
  building or fixing create/edit forms, form sheets, or validation UX. For
  shadcn FormField wrappers and ui/ layering, see react-shadcn.
---

# React Forms

Parent: `react-patterns`. Full samples: [forms.md](../react-patterns/references/forms.md). shadcn layering: `react-shadcn`.

Default samples use controlled + Zod. Use RHF only when the host already does.

## Workflow

1. Zod schema (inline or `*.schema.ts`).
2. Per-field `useState` (or one values object) + `fieldErrors` / `formErrors`.
3. `useServerErrors` for API failures.
4. `FormSheetShell` + `useFormSheetState`; form remount `key`; `hideSubmit`.
5. Submit: clear errors → `safeParse` → mutate; success toast + close; error banner stays open.

## Sheet + form

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

## Fields + errors

```tsx
const { serverErrors, clearServerErrors, setServerError } = useServerErrors(
  "Failed to save customer",
);

function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setFormErrors([]);
  clearServerErrors();
  const parsed = customerSchema.safeParse({ name: name.trim(), /* ... */ });
  if (!parsed.success) {
    setFieldErrors(fieldErrorsFromZod(parsed.error));
    setFormErrors(formErrorsFromZod(parsed.error, customerFieldLabels));
    return;
  }
  createMutation.mutate(parsed.data);
}

<form id={formId} onSubmit={handleSubmit} noValidate>
  <ServerFormError
    errors={serverErrors}
    title="Unable to save customer"
    onDismiss={clearServerErrors}
  />
  {formErrors.length > 0 ? <FormError errors={formErrors} /> : null}
  <FormFieldInput
    label="Name"
    required
    value={name}
    onChange={(e) => setName(e.target.value)}
    error={fieldErrors.name}
  />
</form>
```

```tsx
onSuccess: () => {
  AppToast.success("Customer created");
  onClose();
  onSuccess();
},
onError: (error) => setServerError(error, "Failed to create customer"),
```

## Alternate — RHF

See [forms.md](../react-patterns/references/forms.md) § Alternate. Same banner-first + close-only-on-success rules.

## Anti-patterns

- Defaulting to RHF when the host uses controlled+Zod
- Error toasts for API failures
- Closing sheet on `onError`
- Separate Create / Edit form trees
- Promoting a one-use form into global `components/` — keep form body feature-local ([components.md](../react-patterns/references/components.md))

## Done checklist

- [ ] Controlled+Zod (or host RHF if already used)
- [ ] `FormSheetShell` + remount `key` for sheets
- [ ] Server banner first; success toast; error keeps open
- [ ] `fieldErrorsFromZod` / field `error` props
