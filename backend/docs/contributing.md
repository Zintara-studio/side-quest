# Developer guide

How to work in this codebase without fighting it. Read [architecture.md](./architecture.md) first.

**See also:** [structure.md](./structure.md) · [data-model.md](./data-model.md) ·
[testing.md](./testing.md) · [../CLAUDE.md](../CLAUDE.md)

## Priorities

In order, always: **Correctness > Reliability > User experience > Maintainability > Performance.**
Avoid quick hacks. Never leave a `TODO` as a substitute for implementation. Never destroy data unless
explicitly told — prefer additive schema changes.

## The one pattern: package-by-feature

A domain owns everything it needs in its own package. A feature is *not* spread across global
`controllers/` + `services/` packages.

```
com.sidequest.arena.matches
├── MatchController.java     # thin — maps HTTP, delegates, no logic
├── MatchService.java        # @Transactional business logic
└── dto/                     # request/response records (the API boundary)
```

Shared, cross-cutting code lives in the well-known packages: entities + enums in `model/`, Spring Data
interfaces in `repo/`, the error envelope + pagination + `ApiException` in `common/`, JWT + security in
`security/`, the seeder + caches + OpenAPI in `config/`. See [structure.md](./structure.md).

## Conventions

- **DTO records at the boundary.** Controllers accept and return `record` DTOs from the feature's `dto/`
  package — never expose a JPA entity. Map in the service.
- **Validate inputs** with jakarta bean-validation (`@Valid` on the controller param; `@NotBlank`,
  `@Size`, `@Min`/`@Max`, etc. on the record). Bound anything unbounded (list sizes, weights).
- **Errors** are thrown as `ApiException.badRequest/forbidden/notFound/conflict(...)` and rendered by the
  global handler into `{code, message, details}`. Don't hand-roll error responses.
- **Authorization**: gate admin endpoints with `@PreAuthorize("hasRole('ADMIN')")`; do ownership checks
  in the service (`SecurityUtils.currentUserId()`), throwing `forbidden`. Public reads stay open.
- **Transactions**: service methods that write are `@Transactional`. Reads that must be consistent are
  `@Transactional(readOnly = true)`.
- **Scoring is recompute-from-history.** If you touch scoring, keep `ScoringService.recomputeStandings()`
  idempotent — re-derive from retained `ResultRow`s; never accumulate deltas. Franchise points are
  recomputed **only while a season is ACTIVE** (the season-freeze invariant).
- **Concurrency.** For a check-then-act sequence that can race (create-if-absent, delete-then-insert,
  exclusivity guards), take a **pessimistic row lock** first (`@Lock(PESSIMISTIC_WRITE)` finder, e.g.
  `Player.lockById`, `Match.findByIdForUpdate`, `LeagueSettings.lockById`) and/or add a **DB unique
  constraint** as a backstop. There is intentionally **no `@Version`** anywhere.
- **Caching.** Annotate the reads with `@Cacheable` and evict on the writes with `@CacheEvict`. If a
  service needs to evict its own cache from within, inject `CacheManager` and evict manually — a
  `@CacheEvict` self-call is bypassed by the proxy (and self-injection risks a bean cycle).
- **Comments explain WHY**, anticipating a future maintainer's confusion. Named constants over magic
  numbers, each with a justifying comment.

## Add a new endpoint — checklist

1. **Entity/enum** (if new state): add to `model/`, with `@Table` indexes / unique constraints as needed.
2. **Repository**: a method on the relevant `repo/*Repository` (or a new one). Add a `@Lock` finder if the
   flow is a race-prone check-then-act.
3. **DTO(s)**: request/response `record`s in the feature's `dto/` with validation annotations.
4. **Service**: the `@Transactional` method — authorization, validation, the work, an
   `auditService.record(...)` for admin/state-changing actions, and any `notificationService` fan-out.
5. **Controller**: the mapping (`@GetMapping`/etc.) with `@PreAuthorize` if privileged and `@Valid` on
   the body. Keep it thin.
6. **Cache**: evict the affected caches if you changed cached data.
7. **Test**: extend `SideQuestApiIntegrationTest` (a new `@Order`-ed method) covering the happy path,
   the authz rule (401/403), and at least one edge case.

## Build, test, run

```bash
./mvnw -q compile     # fast type check
./mvnw test           # the 26-test integration suite (must stay green)
./mvnw spring-boot:run   # dev H2 + seeded league on :8080/v1
```

Verify behavioural changes against the real API (curl or the frontend) — see [testing.md](./testing.md).
Requires a **full JDK 21** (a JRE-only box can't build).

## Git

Terse, single-sentence, imperative commit messages; no co-author trailer. **The maintainer commits and
pushes all code** — automated agents should not run git commits.
