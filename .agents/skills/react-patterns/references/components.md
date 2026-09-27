# Components — share only when shared

Don’t create “shared” UI for a single call site. Prefer feature-local components; promote only when reuse is real.

## Default placement

| Put it… | When |
| --- | --- |
| Next to the feature (`pages/<feature>/components/`, route `_components/`, etc.) | Entity forms, one-off cards, feature sheets/dialogs, feature-only helpers |
| App shared kit (`components/form`, `components/table`, `components/ui`, …) | Cross-app primitives: field wrappers, sheet shell, data table, buttons |
| Domain shared (`components/merchant/…`, similar) | List chrome used on many routes, or thin sheet adapters imported by multiple pages |

**Start local.** Extract upward only after a second (real) consumer appears — or when it’s clearly a primitive (input, shell, table).

## Open/closed (components)

**Open for extension, closed for modification** — extend behavior by composing or wrapping; don’t edit a shared component for one screen.

| Do (extend) | Don’t (modify) |
| --- | --- |
| Wrap `Input` in `FormFieldInput` / `PasswordInput` | Change `ui/input.tsx` defaults for one form |
| Pass `className`, `children`, slots, render props | Add a one-off `variant="thatPageOnly"` to a shared Button |
| Feature card that **uses** `Card` + domain content | Fork `Card` into `CustomerCardShared` by editing the primitive |
| Thin `CustomerFormSheet` around `FormSheetShell` | Bake customer titles/mutations into `FormSheetShell` |

```tsx
// ✅ extend — compose the primitive
function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} {...props} />
      <Button type="button" variant="ghost" onClick={() => setVisible((v) => !v)}>
        {visible ? "Hide" : "Show"}
      </Button>
    </div>
  );
}

// ❌ modify — special-case inside the shared primitive
// in ui/input.tsx: if (props.enablePasswordToggle) { ... }
```

```tsx
// ✅ closed shared shell — open via props/slots
<FormSheetShell title={title} formId={formId} submitLabel={submitLabel}>
  <CustomerForm ... />  {/* feature extends without editing the shell */}
</FormSheetShell>

// ❌ open the shell by editing it for one entity
// FormSheetShell.tsx: if (entityType === "customer") title = "Edit customer"
```

**Still apply “share only when shared.”** Open/closed does **not** mean extract everything — it means once something *is* shared, extend it from the outside.

## Good splits

- **Form body** (fields, schema, mutations) → feature-local `*-form.tsx`
- **Sheet chrome** (`FormSheetShell`, titles, `formId`) → thin `*-form-sheet.tsx` (shared only if multiple routes open the same sheet)
- **List chrome** (search bar, toolbar, data table) → shared once many lists use it
- **One-feature card** (`ThemeCard`, `PluginCard`) → stay local even if “card-shaped”

## Promote to shared when

- Two or more unrelated features import it, **or**
- It’s a design-system primitive (no domain words in the API), **or**
- Create + edit + admin (or equivalent) already share one heavy form and forking would drift

## Do not promote when

- “We might reuse this later”
- Only the sheet wrapper needs to be reachable from one list page
- It’s a settings one-liner alias around another form
- You’re abstracting props for a single screen (“flexible SharedCard with 12 optional slots”)

## Anti-patterns

- `components/SharedX.tsx` with a **single** importer
- Moving `customer-form.tsx` into global `components/` just because a sheet exists
- Fusing sheet + form into one mega shared component
- Premature `components/common/` grab-bags
- Duplicating a second “shared” form beside a feature-local one (pick one home)
- Editing a shared primitive for one call site instead of wrapping/composing (violates open/closed)

## Checklist

- [ ] New UI started feature-local
- [ ] Shared kit only for primitives or proven multi-route reuse
- [ ] Form body local; sheet adapter thin
- [ ] No single-use “shared” cards/sections
- [ ] Shared components extended via wrap/compose/slots — not one-off edits inside them
