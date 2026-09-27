---
name: react-shadcn
description: >-
  How to use shadcn/ui in React apps — ui/ vs form/ vs reui layers, CLI add
  vs wrap, FormField* over raw Input, cn(), CSS variables, when not to add
  components. Use when adding shadcn/ReUI pieces, building FormField wrappers,
  or editing components/ui.
---

# React shadcn

How to use [shadcn/ui](https://ui.shadcn.com) (and optional ReUI registry pieces) without forking the design system. Parent: `react-patterns`. Depth: [shadcn.md](../react-patterns/references/shadcn.md). Also: `react-forms`, [components.md](../react-patterns/references/components.md).

## Layers

| Layer | Path | Owns |
| --- | --- | --- |
| **ui** | `@/components/ui` | Registry primitives (`Button`, `Input`, `Sheet`, `Field`, …) |
| **reui** (optional) | `@/components/reui` | Registry composites (data-grid, filters, …) |
| **form** | `@/components/form` | `FormField*` + sheet/error shells — wrap ui, don’t edit ui |
| **feature** | next to the page | One-off layout; import form/ui, don’t copy primitives |

## Quick rules

1. **Add via CLI** — `npx shadcn@latest add <name>` (or `@reui/...`) from the app with `components.json`. Don’t hand-paste registry source.
2. **Wrap, don’t edit** — change product behavior in `FormField*` / feature wrappers; treat `ui/` as vendor-ish.
3. **Forms use `FormField*`** — not raw `Input` + ad-hoc labels/errors on every screen.
4. **`cn()` from `@/lib/utils`** — always for class merges.
5. **Theme via CSS variables** — semantic tokens (`bg-background`, `text-muted-foreground`); no one-off hex on primitives.
6. **Don’t add a component** if compose/wrap already covers it, or the need is one-off/domain-only.

## FormField wrap (sketch)

```tsx
import { Input } from "@/components/ui/input";
import { FormFieldShell } from "./form-field-shell";
import { cn } from "@/lib/utils";

export function FormFieldInput({ label, error, className, id, ...props }) {
  return (
    <FormFieldShell label={label} error={error} fieldId={id}>
      <Input
        id={id}
        aria-invalid={!!error || undefined}
        className={cn("w-full", className)}
        {...props}
      />
    </FormFieldShell>
  );
}
```

## When not to `shadcn add`

- A `FormField*` / existing primitive already does it
- Domain picker → `form/<domain>/` composing Select/Combobox
- One page’s toolbar chip → feature file + `Button`/`Badge`
- Color tweak → CSS variables, not a new component

## Anti-patterns

- Editing `ui/input.tsx` for one screen
- Hand-copying registry files from the docs site
- Skipping `FormField*` and reinventing label/error layout
- Second `cn` / parallel `@/ui` folder outside `components.json`
