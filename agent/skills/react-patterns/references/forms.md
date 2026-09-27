# Forms — controlled + Zod

**Default:** `useState` + Zod `safeParse` + presentational `FormField*` + `ServerFormError` at top.  
**Alternate:** RHF + `Controller` (use when the host already does — not for default sheet CRUD).

`FormField*` wrap shadcn primitives — see [shadcn.md](shadcn.md). Match the host. Don’t switch form stacks unless asked.

## Shared contracts

1. One Zod schema; keep it aligned with the API input.
2. `FormField*` take `value` / change handler / `error` — not form-library-aware.
3. One upsert UI for create + edit (`mode: "create" | "update"` and/or `entity`).
4. Hydrate when the sheet opens; close **only on success**.
5. Error order in `<form>`: **server banner → optional form-level Zod → fields**.

---

## Default — sheet form

### Props

```tsx
type CustomerFormProps = {
  mode?: "create" | "update";
  customer?: CustomerFormValues | null;
  onSuccess: () => void;
  onClose: () => void;
} & Partial<FormInSheetProps>; // formId, hideSubmit?, onPendingChange?
```

### State + hydrate

```tsx
const [name, setName] = useState("");
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
const [formErrors, setFormErrors] = useState<string[]>([]);
const { serverErrors, clearServerErrors, setServerError } = useServerErrors(
  "Failed to save customer",
);

useEffect(() => {
  setName(customer?.name ?? "");
  // ...other fields
  setFieldErrors({});
  setFormErrors([]);
  clearServerErrors();
}, [mode, customer, clearServerErrors]);
```

### Submit + mutations

```tsx
const createMutation = useMutation({
  mutationFn: (input) => /* project client */,
  onSuccess: () => {
    AppToast.success("Customer created"); // success only — not API errors
    onClose();
    onSuccess(); // parent refetches
  },
  onError: (error: unknown) => {
    setServerError(error, "Failed to create customer");
  },
});

function handleSubmit(event: React.FormEvent) {
  event.preventDefault();
  setFormErrors([]);
  clearServerErrors();

  const parsed = customerSchema.safeParse({
    name: name.trim(),
    email: email.trim(),
    phoneNumber: phoneNumber.trim(),
  });
  if (!parsed.success) {
    setFieldErrors(fieldErrorsFromZod(parsed.error));
    setFormErrors(formErrorsFromZod(parsed.error, customerFieldLabels));
    return;
  }
  isUpdate ? updateMutation.mutate(parsed.data) : createMutation.mutate(parsed.data);
}
```

### Form body (error order + fields)

```tsx
<form id={formId} className="space-y-4" onSubmit={handleSubmit} noValidate>
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
    onChange={(event) => setName(event.target.value)}
    error={fieldErrors.name}
    disabled={isPending}
  />

  {!hideSubmit ? (
    <Button type="submit" disabled={isPending}>
      {isPending ? "Saving…" : isUpdate ? "Save changes" : "Create customer"}
    </Button>
  ) : null}
</form>
```

Wire `onPendingChange?.(isPending)` so the sheet footer can disable/spin.

### Sheet shell

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
    {...formProps} // formId, hideSubmit: true, onPendingChange
  />
</FormSheetShell>
```

Schema: inline in small forms, or sibling `*.schema.ts` for large ones.

---

## Alternate — RHF + Controller

```tsx
const form = useForm<SupplierFormValues>({
  resolver: zodResolver(supplierFormSchema),
  defaultValues: defaultSupplierFormValues,
});

useEffect(() => {
  if (!open) return;
  form.reset(entity ? toSupplierFormValues(entity) : defaultSupplierFormValues);
  setServerErrors([]);
}, [open, entity, form]);

<Controller
  control={form.control}
  name="name"
  render={({ field, fieldState }) => (
    <FormFieldInput
      value={field.value}
      onChange={field.onChange}
      onBlur={field.onBlur}
      error={fieldState.error?.message}
    />
  )}
/>
```

| Control | Change prop |
| --- | --- |
| Text / textarea | `onChange={field.onChange}` |
| Select / number / date | `onValueChange={field.onChange}` |
| Switch / checkbox | `onCheckedChange={field.onChange}` |

`setValue` — cross-field only. Still put `<FormError errors={serverErrors} title="Unable to…" />` first in the form.

---

## Toasts vs banners

| Event | Where |
| --- | --- |
| Save success | `AppToast.success` (then close) |
| API / server failure | Top-of-form `ServerFormError` — **not** an error toast |
| Client Zod | Field `error` + optional `FormError` |

## Anti-patterns

- Switching to RHF when the host uses controlled+Zod
- Custom `setField` helper layer
- Separate CreateForm / EditForm trees
- Closing the sheet in `onError`
- Toasting API failures instead of the top banner
