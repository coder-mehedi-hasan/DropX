# Layout — feature co-location

## Default shape

```
api/<domain>/<feature>/
├── dto/                 # or inputs/ — create/update/list inputs
├── <feature>.service.ts # application / use-cases
├── <feature>.<transport>.ts  # controller | resolver | router
├── <feature>.module.ts  # if the host uses modules
├── *-repository.ts      # optional persistence adapter
└── __tests__/           # when tests exist
```

Domains group features (`identity`, `inventory`, `sell`, …). A domain aggregator registers its features.

## Layers

| Layer | Owns | Does not own |
| --- | --- | --- |
| **Transport** | HTTP/GraphQL/RPC mapping, auth context extraction | Business rules, raw DB queries |
| **Application (service)** | Validation of rules, orchestration, domain errors | Framework decorators as logic |
| **Persistence** | Queries scoped by caller predicates | Product policy decisions |
| **Shared domain** | Entities/types used by multiple apps | Transport-only DTOs |

## Shared domain models

Keep persistence/API entity definitions in a **shared package** (or top-level `entities/`) when multiple apps/surfaces consume them. Don’t duplicate the same entity in each API app.

## Open/closed

Shared libraries and base repositories: **extend via composition or subclass hooks**, don’t special-case one feature inside a shared base for a single caller. Feature code stays in the feature folder.

## Anti-patterns

- Business rules only in transport handlers
- God “utils” modules that own many domains
- Copy-pasting entity schemas per app
- Cross-domain imports that create cycles — invert via events/shared package
