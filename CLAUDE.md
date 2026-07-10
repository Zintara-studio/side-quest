# CLAUDE.md — Side Quest Backend

Index and operating rules for any Claude Code session working in this repo. Read the linked docs before
making architectural decisions; **understand the existing design before changing it** (this is a mature
codebase — extend abstractions, don't replace working systems).

## What this is

A Spring Boot (Java 21) REST API for an amateur esports league — auth, players, franchises, games, a
pre-season player auction, matches with live rooms and per-round scoring, registrations, seasons,
standings, announcements, disputes, notifications, and an admin control room. One `/v1` API surface,
role-separated. Default `dev` profile = in-memory H2 + seeded demo league; `postgres` profile = prod.

## Documentation map

| Read this… | …when you need |
|------------|----------------|
| [README.md](./README.md) | The overview + quick start |
| [docs/architecture.md](./docs/architecture.md) | The big picture: request flow, auth, scoring, concurrency, realtime, caching, seasons |
| [docs/structure.md](./docs/structure.md) | Where code lives (package-by-feature tree) |
| [docs/tech-stack.md](./docs/tech-stack.md) | The stack + versions + rationale |
| [docs/data-model.md](./docs/data-model.md) | Entities, relationships, enums, **invariants** |
| [docs/api.md](./docs/api.md) | The full REST + WebSocket surface |
| [docs/setup.md](./docs/setup.md) | Run, profiles, env vars, Docker, deploy |
| [docs/testing.md](./docs/testing.md) | The integration suite + how to verify |
| [docs/troubleshooting.md](./docs/troubleshooting.md) | Common failure modes → fixes |
| [docs/contributing.md](./docs/contributing.md) | Conventions + "add a feature" checklist |
| [docs/status.md](./docs/status.md) | What's built, limitations, roadmap |
| [docs/caching-hld.md](./docs/caching-hld.md) | Caching HLD |

## Conventions (enforce these)

- **Package-by-feature.** A domain = its own package with `Controller + Service + dto/`. Entities live in
  `model/`, repositories in `repo/`. Don't create layer-wide `controllers/`/`services/` packages.
- **DTO records at the API boundary**; never leak entities. Validate request bodies with `@Valid` +
  jakarta bean-validation annotations.
- **Errors** go through `ApiException` → the global handler → a `{code, message, details}` envelope.
- **Method security** via `@PreAuthorize` (`@EnableMethodSecurity`); public catalog reads are open, all
  mutations require a token, admin actions require `ADMIN`. Use `SecurityUtils` for the current user.
- **Scoring is recompute-from-history** — `ScoringService.recomputeStandings()` is idempotent and
  re-derives everything from retained `ResultRow`s. Never accumulate deltas.
- **Season-freeze invariant:** `SeasonStanding` is a frozen value-copy; franchise points are
  season-scoped and only recomputed while a season is `ACTIVE`. Don't rewrite finished seasons.
- **Concurrency:** the check-then-act races are closed with **pessimistic row locks** (`lockById` /
  `findByIdForUpdate` — season finish/start on `LeagueSettings`, result publish on `Match`, registration
  exclusivity on `Player`) and **DB unique constraints**. There is intentionally **no `@Version`**.
- **Caching:** Caffeine with `@CacheEvict` on the writes that change the data. Beware the
  self-injection / bean-cycle trap — inject `CacheManager` rather than `@CacheEvict` on a self-call.
- **Comments explain WHY.** Named constants with justifying comments, no magic numbers, no TODOs left as
  a substitute for implementation.

## Priorities & workflow

- **Correctness > Reliability > UX > Maintainability > Performance.** Avoid quick hacks.
- **Never destroy data** unless explicitly told; prefer additive schema changes. Prod runs
  `ddl-auto: update` (additive) — Flyway is the eventual answer for anything non-additive.
- **Verify before "done":** `./mvnw test` (26 integration tests) must stay green; compile with
  `./mvnw -q compile`. For behavioural changes, drive the real API (curl / the frontend) — see
  [docs/testing.md](./docs/testing.md).
- **Strict tooling is welcome** (`-Wall`-equivalent discipline; keep the build warning-clean).

## Environment notes

- Runs on **:8080** with context path **/v1**. Full JDK 21 required to build (a JRE-only box fails).
- `postgres` profile fails fast without `SIDEQUEST_JWT_SECRET`, and without `SMTP_*` outside `dev`
  (otherwise OTPs would log to stdout). A dev-profile boot logs a loud warning.
- Not a monorepo with the frontend — sibling repo `../SideQuests arena frontend`. The user commits and
  pushes all code themselves; **do not run git commits.**
