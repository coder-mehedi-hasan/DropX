# DropX form building blocks

These components bind the shared DropX primitives to `react-hook-form` through
the existing `FormField` contract. They keep labels, descriptions, focus rings,
validation messages, and required markers consistent across the admin, rider,
and customer surfaces.

```tsx
import { FormInput, FormOtpInput } from "@dropx/ui"

<FormInput<MyFormValues> name="email" label="Email" type="email" required />
<FormOtpInput<MyFormValues> name="code" label="Verification code" />
```

Available building blocks:

- `FormInput`
- `FormPasswordInput`
- `FormTextarea`
- `FormSelect`
- `FormCheckbox`
- `FormOtpInput`

Use the feature's existing `Form` provider and schema/resolver. Server errors
should remain in the form's top-level error banner; field errors flow through
`FormMessage`.
