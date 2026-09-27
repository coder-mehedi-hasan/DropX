---
name: api-review
description: >-
  Backend review checklist — TENANT, AUTH, ERR, LAY, PAGE, SIDE. Use when
  reviewing API PRs, modules, resolvers, controllers, or services. Framework-
  agnostic.
---

# API Review

Run through each flag. Mark **blocker** / **nit** / **ok**.

## TENANT

- [ ] Every tenant-owned read/write includes tenant (or vendor/customer) scope
- [ ] Creates stamp tenant from auth context
- [ ] Client-supplied tenant is not the sole trust boundary
- [ ] Missing tenant fails closed on merchant/vendor paths

## AUTH

- [ ] New operations appear in the permission/policy catalog
- [ ] AuthN/AuthZ enforced server-side (not UI-only)
- [ ] Public ops are explicitly marked public

## ERR

- [ ] Domain failures use stable `code` + safe `message`
- [ ] Transport preserves codes (no catch-all that strips them)
- [ ] Unexpected errors don’t leak stacks/internals

## LAY

- [ ] Transport is thin; rules live in services
- [ ] Feature co-located under `api/<domain>/<feature>/`
- [ ] Shared entities not duplicated casually

## PAGE

- [ ] Lists use the standard query + `{ nodes, meta }` (or host equivalent)
- [ ] Limit capped; filters applied with tenant scope

## SIDE

- [ ] Mail/queues/events after successful write
- [ ] Side-effect failure doesn’t silently corrupt primary outcome

## Quick blockers

Any of: unscoped `findById`/`update`/`delete` · new op without catalog entry · fat transport with DB+rules · dropped error codes · new pagination shape.
