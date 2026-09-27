---
name: api-modules
description: >-
  Scaffold a backend feature module — folder layout, DTO/service/transport
  checklist, tenancy, auth catalog, pagination, domain errors. Framework-
  agnostic. Use when adding a new API domain feature or CRUD surface.
---

# API Modules

Build one feature at a time. Prefer the host’s existing patterns over inventing a parallel layout.

## Checklist — add a feature

```
- [ ] Folder under api/<domain>/<feature>/
- [ ] Input DTOs (create / update / list) with validation
- [ ] Service with domain rules + DomainError codes
- [ ] Thin transport (controller / resolver / route)
- [ ] Persistence scoped by tenant (or surface-equivalent)
- [ ] List returns { nodes, meta } (or host standard)
- [ ] Operation registered in auth/permission catalog
- [ ] Shared entity updated if the model is shared across apps
- [ ] Side effects (mail/queue/events) after durable write
- [ ] Domain aggregator registers the feature module
```

## Naming

Pick one convention per API and stick to it:

- Folders: `kebab-case` or host default
- Operations: `{domain}{Action}` / `{domain}__{operation}` / REST verbs — **consistent**
- Permissions: `{domain}.{resource}.{action}` or host catalog format

## Layers reminder

| File | Responsibility |
| --- | --- |
| `*.input` / DTO | Boundary validation |
| `*.service` | Rules, orchestration, errors |
| `*.resolver` / controller | Map args → service |
| `*-repository` | Scoped queries |

## Don’t

- Put business rules only in transport
- Skip tenant on “just this one” findById
- Ship the op without a permission entry
- Invent a new list response shape

Deep dives: `api-patterns`. Review: `api-review`.
