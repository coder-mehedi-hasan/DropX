# UX — visual design guidelines

Practical UI rules for product screens. Distilled for agents from *Refactoring UI* (Adam Wathan & Steve Schoger) — apply alongside host design tokens; don’t invent a parallel design system.

## Hierarchy

- **Not everything is equal.** Decide primary / secondary / tertiary before styling. If everything competes, the UI feels noisy.
- **Size isn’t enough.** Prefer weight and color (softer secondary text) over making primaries huge and secondaries tiny.
- **Emphasize by de-emphasizing.** When the active/primary item won’t pop, soften competitors instead of further boosting the hero.
- **No grey text on colored backgrounds.** Soften by moving text *toward* the background color (same hue family), not by painting it neutral grey or only lowering opacity (looks dull/muddy).
- **Labels are a last resort for data.** Prefer value-first layouts users can parse by format (dates, emails, money) over endless `Label: value` rows that flatten hierarchy. Keep accessible names (aria/labels on controls) — this is about *presentation* of read-only data.
- **Visual hierarchy ≠ document hierarchy.** An `<h2>` doesn’t have to be the biggest thing on the page; style for importance, not tag name alone.

## Layout & spacing

- **Start with too much white space**, then remove. Crowding is harder to fix later.
- **Use a spacing scale** with meaningful steps (small gaps differ by a few px; large gaps jump more). Don’t pick one-off values between scale steps.
- **Don’t stretch to fill the screen.** Give each block the width it needs — forms and reading columns especially.
- **Avoid ambiguous spacing.** Within a field group, space label→input tighter than input→next label so groups read as units.
- **Fewer borders.** Separate with spacing, subtle background, or light shadow before drawing boxes everywhere.

## Type

- **Stick to a type scale** (few sizes). Don’t use every px from 10–24.
- **Line length ~45–75 characters** for readable paragraphs (`~20–35em` is a useful ballpark). Tables/UI chrome are exempt.
- **Line-height scales with size** — large headings tighter; body a bit looser.
- Align text for readability (left for LTR paragraphs; don’t center long copy).

## Color & feedback

- **Limit choices** — use the host palette / shade scale; don’t invent one-off hexes per screen.
- **Don’t rely on color alone** for status (success/error/up/down) — pair with icon, text, or shape.
- **Accessible contrast** for text and controls; mute secondaries without dropping below readable contrast.
- **Empty states matter** — design the zero-data view (message + primary action), not only the populated table. Lists: distinct empty vs error (see `react-lists`).
- **Success vs error chrome** — keep destructive/error styling reserved; don’t paint every button as primary.

## Process (when designing a new surface)

1. Start with the **feature** (fields, actions, data), not the app shell/nav.
2. Work **structure first** (hierarchy, spacing) — typeface flourishes and shadows later.
3. Optional: think in **grayscale** first so spacing/contrast do the work before accent color.

## Checklist

- [ ] Clear primary action per view
- [ ] Secondary text softer via weight/color, not tiny unreadable sizes
- [ ] Form fields grouped with unambiguous spacing
- [ ] Table/list empty state with CTA
- [ ] Status not color-only
- [ ] Borders only where spacing/bg isn’t enough
- [ ] Page doesn’t force full-bleed width on narrow content (forms, settings)

## Anti-patterns

- Decorating the nav before the feature works
- Every row of a detail panel is identical `Label: value` weight
- Grey-on-brand-color muted text
- Walls of equal-weight text and equal-weight buttons
- Borders around every card/section “for structure”
- Beautiful sample data, blank empty state in production
