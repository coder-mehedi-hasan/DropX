# shadcn — usage guidelines

Portable rules for apps using [shadcn/ui](https://ui.shadcn.com) (and optional [ReUI](https://reui.io) registry). Match the host’s `components.json`; don’t invent a second UI tree.

## Layers

| Layer | Typical path | Owns | Does not own |
| --- | --- | --- | --- |
| **ui** | `@/components/ui` | CLI-installed primitives | Domain labels, Zod wiring, entity pickers |
| **reui** | `@/components/reui` | Registry composites (data-grid, filters, cascader) | App column defs / list chrome |
| **form** | `@/components/form` | `FormField*`, `FormSheetShell`, form errors | One-off page layout |
| **table** (optional) | `@/components/table` | Thin facade over ReUI grid | Forking `reui/data-grid` per feature |
| **feature** | `pages/<feature>/components` | Feature forms, cards, one-off sheets | Copy-pasted `Input`+label blocks |

Feature code: import `@/components/form` for fields, `@/components/ui/*` for chrome (Button, Sheet, Dialog). See [components.md](components.md) for share-vs-local.

## `components.json`

```json
{
  "style": "<project-style>",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "<lucide|tabler|…>",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

Optional ReUI:

```json
"aliases": { "reui": "@/components/reui" },
"registries": {
  "@reui": "https://reui.io/r/{style}/{name}.json"
}
```

**Do:** keep aliases aligned with tsconfig `@/`. One style for the app.  
**Don’t:** add a parallel `@/ui` outside this config.

## Registry hygiene

| Do | Don’t |
| --- | --- |
| `npx shadcn@latest add button` / `add @reui/data-grid` | Paste registry source from the website |
| Accept CLI overwrites on `ui/` / `reui/` when updating | “Quick fix” one screen inside `ui/input.tsx` |
| Compose wrappers (`password-input`, `FormFieldMoney`) | Fork `input.tsx` for a single feature |
| Document rare intentional token tweaks on primitives | Restyle defaults differently per route |

**Allowed rare edits to `ui/`:** type/import breakage after upgrade; app-wide design-system token class changes (once, documented).

## FormField* wraps primitives

Labeled fields are **app wrappers**, not edits to `field.tsx` / `input.tsx`.

```tsx
// FormFieldShell — sketch
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";

export function FormFieldShell({
  label,
  description,
  error,
  fieldId,
  required,
  children,
}: {
  label: string;
  description?: string;
  error?: string;
  fieldId: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={fieldId}>
        {label}
        {required ? " *" : null}
      </FieldLabel>
      <FieldContent>
        {children}
        {description ? (
          <FieldDescription id={`${fieldId}-description`}>{description}</FieldDescription>
        ) : null}
        {error ? <FieldError id={`${fieldId}-error`}>{error}</FieldError> : null}
      </FieldContent>
    </Field>
  );
}
```

```tsx
// FormFieldInput — sketch
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FormFieldShell } from "./form-field-shell";

export function FormFieldInput({
  id,
  label,
  description,
  error,
  required,
  className,
  ...inputProps
}: React.ComponentProps<typeof Input> & {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <FormFieldShell
      label={label}
      description={description}
      error={error}
      fieldId={id!}
      required={required}
    >
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [description ? `${id}-description` : null, error ? `${id}-error` : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={cn("w-full", className)}
        {...inputProps}
      />
    </FormFieldShell>
  );
}
```

Wire `value` / `onChange` / `error` from the form (controlled+Zod or RHF `Controller`) — wrappers stay form-library-agnostic. See [forms.md](forms.md).

Domain pickers (employee, account, …) → `form/<domain>/…` composing Select/Combobox wrappers.

## `cn()`

```ts
// @/lib/utils
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Always `import { cn } from "@/lib/utils"`. Don’t string-concat Tailwind classes or redefine `cn` in feature files.

## Theming

- One CSS entry: Tailwind + shadcn theme (`cssVariables: true`).
- Prefer semantic utilities: `bg-background`, `text-muted-foreground`, `border-input`, `bg-primary`.
- Change brand look in `:root` / `.dark` tokens — not scattered hex in features.
- Don’t introduce a second theme system that fights shadcn variables.

## When **not** to add a shadcn component

Skip `shadcn add` when:

1. Existing `FormField*` / `ui` primitive already covers it — compose or wrap.
2. Need is domain-specific → `form/<domain>/`.
3. Need is one-off layout → feature component + `Button` / `Badge` / `cn`.
4. Need is already in ReUI / table facade.
5. You’re only changing color — edit CSS variables.

**Do** CLI-add when the **interaction primitive** is missing (no Slider, no ContextMenu, …) and will be reused.

## Checklist

- [ ] New primitive installed via CLI into `ui/` (or `reui/`)
- [ ] Product fields go through `FormField*`
- [ ] No casual edits to registry files for one screen
- [ ] `cn` from `@/lib/utils`
- [ ] Colors via tokens, not one-off hex on primitives
- [ ] Single-use UI stays feature-local ([components.md](components.md))

## Anti-patterns

- Hand-pasted registry components
- Raw `Input` + custom label/error on every form
- Forking data-grid into a feature folder
- Parallel UI directories outside `components.json`
- “Shared” wrapper used once ([components.md](components.md))
