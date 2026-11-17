---
title: Side Quest Backend
emoji: 🎮
colorFrom: red
colorTo: gray
sdk: docker
app_port: 8080
pinned: false
license: other
---

# Side Quest — Backend

A **Spring Boot (Java 21)** REST API for running an amateur, multi-game **esports league** end to end:
players and franchises, a pre-season player **auction**, match scheduling with live rooms and per-round
scoring, registrations, standings, announcements, disputes, notifications, and an admin control room.
One API surface (`/v1`), shared by the player app and the admin panel, separated by role.

> **Runs out of the box.** The default `dev` profile uses an **in-memory H2** database seeded with a
> demo league (Season 04) — no external services required. Swap to PostgreSQL with the `postgres`
> profile for a persistent, production-shaped deployment.

- **Base URL:** `/v1` · **Swagger UI:** `/v1/docs` (dev) · **OpenAPI:** `/v1/api-docs` · **Health:** `/v1/actuator/health`
- **~16.8K LOC** across 238 files · **118 REST endpoints** · **~35 JPA entities** · **26 integration tests**

## Quick start

```bash
# needs a full JDK 21 (not just a JRE) + the bundled Maven wrapper
./mvnw spring-boot:run                 # → http://localhost:8080/v1/docs   (dev: H2 + seeded demo league)

# or build and run the jar
./mvnw -DskipTests package && java -jar target/sidequest-backend.jar
```

```bash
# Docker
docker build -t sidequest-backend .
docker run --rm -p 8080:8080 sidequest-backend        # → http://localhost:8080/v1/docs
```

A full **PostgreSQL + backend + frontend** stack lives in `../docker-compose.yml`:

```bash
cd ..                          # the workspace root ("SideQuests arena/")
docker compose up --build      # frontend :3000, backend :8080, Postgres :5433
```

## Demo credentials

Every seeded account uses the password `password`.

| Email                   | Role                  |
|-------------------------|-----------------------|
| `admin@sidequest.gg`    | `ADMIN`               |
| `vortex@sidequest.gg`   | franchise owner (RXG) |
| `raghavan@sidequest.gg` | `PLAYER` (RXG)        |
| `blitz@sidequest.gg`    | verified free agent   |

```bash
TOKEN=$(curl -s -X POST localhost:8080/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"identifier":"admin@sidequest.gg","password":"password"}' | jq -r .accessToken)
curl localhost:8080/v1/auth/me -H "Authorization: Bearer $TOKEN"
```

## What's inside

**Package-by-feature** under `com.sidequest.arena` — each domain owns its `Controller + Service + dto/`,
with shared `model/` (entities + enums), `repo/` (Spring Data), `common/` (error envelope, pagination),
`security/` (JWT + method security), and `config/` (seeder, cache, OpenAPI).

| Area | What it does |
|------|--------------|
| **Auth** | Email+password with OTP email verification, Google sign-in (with a first-login **onboarding** step to claim a username), JWT access (1h) + rotating refresh (30d), BCrypt, roles `PLAYER` / `FRANCHISE_MANAGER` / `ADMIN`. Username rules (no spaces, case-insensitive-unique, immutable) + a live availability check |
| **Franchises / Players** | Rosters, leadership invites, per-player privacy, DB-blob media (avatars/logos/banners), designation tags. Profile edit is **owner-only** (admins/franchise-leads may view every field, incl. account email, but not edit). Franchise management is super-admin-only |
| **Games / Scoring** | Per-game system-wide scoring config (points-per-kill, placement ladder, standings weight) + an idempotent recompute engine. Popularity is **community-vote-driven** — `round(100 × distinct game voters / distinct total voters)`, recomputed from `GameVote`s (concurrency-safe), not admin-set |
| **Matches** | Schedule → live room (polled messages) → lineups → per-round results → standings; admin void/delete/reschedule with frozen-season guards |
| **Registrations** | Solo / squad (with invites) / FFA / franchise-proposal / auction-pool entries; self-service withdrawal |
| **Auctions** | Pre-season player auction: draft → lobby → live bidding (1s sweep, anti-snipe) → assign / re-auction / add-funds → complete, with restart recovery. The standing **pool** is viewable (`GET /auctions/pool`) even before an auction exists |
| **Seasons** | Finish snapshots a frozen `SeasonStanding`; start resets franchise points (season-scoped); an all-time table |
| **Comms** | Announcements + registration calls, disputes, in-app notifications, an admin audit trail (append-only, scheduled retention purge) |
| **URLs / media** | Human-readable slugs everywhere (`/players/<gamerTag>`, `/franchises/<tag>`, `/matches/<slug>`, `/announcements/<shortCode>`) — every read seam resolves slug-or-UUID. Media (avatars/logos/banners) are cropped client-side to a fixed ratio before upload |
| **Realtime** | Raw WebSocket hub `/ws/live/{standings,matches/{id},auctions/{id},me}` — the auction channel is bidders-only |

## Documentation

Layered docs live in [`docs/`](./docs) — start with the [architecture](./docs/architecture.md) and the
[developer guide](./docs/contributing.md):

| Doc | |
|-----|--|
| [architecture.md](./docs/architecture.md) | Request flow, auth, scoring engine, concurrency, realtime, caching |
| [structure.md](./docs/structure.md) | Package tree → responsibility |
| [tech-stack.md](./docs/tech-stack.md) | Every layer, version, and why |
| [data-model.md](./docs/data-model.md) | Entities, relationships, enums, invariants |
| [api.md](./docs/api.md) | Full REST + WebSocket reference (base `/v1`) |
| [setup.md](./docs/setup.md) | Run, profiles, env vars, Docker, deploy |
| [testing.md](./docs/testing.md) | The integration suite + verification practice |
| [troubleshooting.md](./docs/troubleshooting.md) | Common issues → fixes |
| [status.md](./docs/status.md) | Feature inventory, limitations, roadmap |
| [caching-hld.md](./docs/caching-hld.md) | Caching design (HLD) |

## Stack

Java 21 · Spring Boot 3 (Web MVC, Data JPA, Security, WebSocket, Cache, Mail, Actuator, Validation) ·
Hibernate + **H2 (dev) / PostgreSQL (prod)** · **jjwt** for JWT + BCrypt (+ `google-api-client` for
Google sign-in) · **Caffeine** cache (evict-on-write) · **springdoc-openapi** / Swagger UI · Lombok ·
Maven. Deliberately *not* used: Redis (in-process pub/sub instead), S3 (media are DB blobs), Flyway (a
roadmap item — schema is `ddl-auto: validate/update`).

## Test

```bash
./mvnw test            # SideQuestApiIntegrationTest — 26 end-to-end tests against H2
```

Covers the auth/token flow, RBAC (401 anon / 403 non-admin / 200 admin), the scoring engine
(schedule → publish → recompute + per-match leaderboard), the season-freeze invariant, match lifecycle
and void/delete guards, per-game scoring + weight, roster tags, registration withdrawal, auction
pool-lock, media caps, and the per-field privacy matrix. See [docs/testing.md](./docs/testing.md).
