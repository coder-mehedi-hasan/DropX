---
name: react-ux
description: >-
  Visual UX guidelines for React product UI — hierarchy, spacing,
  type, color, empty states, fewer borders. Use when polishing layout, fixing
  noisy screens, designing empty states, or improving visual hierarchy.
---

# React UX

Visual design rules for product UI. Full reference: [ux.md](../react-patterns/references/ux.md). Parent: `react-patterns`.

Inspired by *Refactoring UI* — apply with the host’s tokens; don’t invent a new palette.

## Quick rules

1. **Hierarchy first** — primary / secondary / tertiary; emphasize by softening competitors.
2. **Weight + color over size alone** for hierarchy.
3. **Spacing scale** — start roomy; group related fields tighter than groups.
4. **Fewer borders** — prefer space / background / light elevation.
5. **Type scale** — few sizes; readable line length for paragraphs.
6. **Don’t rely on color alone** for status.
7. **Design empty states** (copy + CTA), not only populated views.
8. **Feature before shell** — build the workflow UI before obsessing over nav chrome.

## Checklist

- [ ] One clear primary action
- [ ] Secondary text softer, still readable
- [ ] Form groups have unambiguous spacing
- [ ] Empty list/table has message + action
- [ ] Status uses icon/text, not color only
- [ ] No border-around-everything layout

## Anti-patterns

- Grey muted text on colored backgrounds
- Every detail row equal `Label: value` weight
- Full-bleed stretched forms
- Polished sample data, neglected empty state
