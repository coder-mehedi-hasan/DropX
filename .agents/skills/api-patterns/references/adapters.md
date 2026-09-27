# Adapters — optional framework mapping

These are **examples**, not requirements. Portable skills stay framework-agnostic.

## NestJS

| Concern | Typical mapping |
| --- | --- |
| Feature module | `@Module` + domain aggregator |
| Transport | `@Resolver` / `@Controller` |
| Validation | `ValidationPipe` + class-validator DTOs |
| Tenancy | Guard/decorator reading `x-tenant` or JWT → `@Tenant()` |
| AuthZ | Global guard + permission catalog package |
| Persistence | Repository / `Model` injected into service |

## GraphQL

| Concern | Typical mapping |
| --- | --- |
| Ops naming | `{domain}__{operation}` or host convention — stay consistent per API |
| List args | `where: ListQuery` |
| Errors | `extensions.code` from `DomainError` |
| Auth docs | Description/annotations; still enforce in guard |

## REST

| Concern | Typical mapping |
| --- | --- |
| Lists | Query string → `ListQuery` |
| Errors | `{ code, message }` JSON body |
| Versioning | `/v1/...` if the host uses it |

## Mongo / SQL

| Concern | Typical mapping |
| --- | --- |
| Tenant scope | Always include `tenantId` (or org FK) in filter/WHERE |
| Soft delete | Compose with tenant filter |
| Transactions | Mongo sessions / SQL `BEGIN` — only when needed |

Do not treat any row above as mandatory for every project — **match the host**.
