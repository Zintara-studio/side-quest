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

A Spring Boot implementation of the **Side Quest Backend Architecture** — a modular REST API for an
amateur esports league: players, franchises, games, matches, registrations, standings, announcements,
a realtime hub, and an admin control room. One API surface, shared by the player app and admin panel,
separated by role.

> Runs out of the box with an **in-memory H2** database seeded with a demo league (Season 04) — no
> external services required. Swap to PostgreSQL with the `postgres` profile.

- **Base URL:** `/v1`  ·  **Swagger UI:** `/v1/docs`  ·  **OpenAPI:** `/v1/api-docs`  ·  **Health:** `/v1/actuator/health`
- On a deployed Hugging Face Space the API is at `https://<your-space>.hf.space/v1/...`

## Run locally

```bash
# with Java 21 + Maven
mvn spring-boot:run                    # → http://localhost:8080/v1

# or as a jar
mvn -DskipTests package && java -jar target/sidequest-backend.jar
```

## Run with Docker

```bash
docker build -t sidequest-backend .
docker run --rm -p 8080:8080 sidequest-backend
# → http://localhost:8080/v1/docs
```

## Deploy to Hugging Face Spaces (Docker SDK)

This repo is a ready-to-deploy **Docker Space**: the root `Dockerfile` builds and runs the app, and
the YAML header above tells Spaces to use the Docker SDK on port `8080`.

```bash
pip install -U huggingface_hub
huggingface-cli login                                  # paste a write token
huggingface-cli repo create sidequest-backend --type space --space_sdk docker

git remote add space https://huggingface.co/spaces/<your-username>/sidequest-backend
git push space main
```

Spaces builds the `Dockerfile`, runs the container, and routes traffic to `app_port: 8080`. The
container runs as the non-root uid `1000` that Spaces expects, listens on `0.0.0.0:8080`, writes
nothing to disk (H2 is in-memory), and logs to stdout. Once it's **Running**, open
`https://<your-username>-sidequest-backend.hf.space/v1/docs`.

> Tip: to keep public demo data resettable, leave the default `dev` profile (in-memory H2 + seed).
> For a persistent DB, set `SPRING_PROFILES_ACTIVE=postgres` and the `SPRING_DATASOURCE_*` secrets in
> the Space settings.

## Demo credentials (password is `password` for every seeded account)

| Email                   | Role              |
|-------------------------|-------------------|
| `admin@sidequest.gg`    | ADMIN             |
| `manager@sidequest.gg`  | FRANCHISE_MANAGER |
| `raghavan@sidequest.gg` | PLAYER            |

```bash
TOKEN=$(curl -s -X POST localhost:8080/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"identifier":"admin@sidequest.gg","password":"password"}' | jq -r .accessToken)
curl localhost:8080/v1/auth/me -H "Authorization: Bearer $TOKEN"
```

## API surface (base `/v1`)

| Group | Routes |
|-------|--------|
| **Auth** | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| **Players** | `GET /players`, `GET /players/{id}`, `GET /players/{id}/matches`, `GET /players/{id}/usernames`, `PATCH /players/{id}`, `PATCH /players/{id}/status` 🔒 |
| **Franchises** | `GET /franchises`, `GET /franchises/{id}`, `GET /franchises/{id}/roster`, `GET /franchises/{id}/matches`, `POST /franchises` 🔒, `PATCH /franchises/{id}` 🔒, `POST /franchises/{id}/roster` 🔒 |
| **Games** | `GET /games`, `GET /games/{id}`, `PATCH /games/{id}` 🔒 |
| **Matches** | `GET /matches`, `GET /matches/{id}`, `GET /matches/{id}/leaderboard`, `POST /matches` 🔒, `PATCH /matches/{id}` 🔒, `POST /matches/{id}/results` 🔒 |
| **Registrations** | `POST /registrations`, `GET /registrations` 🔒, `GET /registrations/{id}` 🔒, `POST /registrations/{id}/approve` 🔒, `POST /registrations/{id}/reject` 🔒 |
| **Standings** | `GET /standings`, `GET /leaderboard/players`, `GET /leaderboard/games/{id}` |
| **Announcements** | `GET /announcements`, `GET /announcements/{id}`, `POST /announcements` 🔒, `PATCH /announcements/{id}` 🔒, `DELETE /announcements/{id}` 🔒 |
| **Realtime (WS)** | `WS /ws/live/standings`, `WS /ws/live/matches/{id}`, `WS /ws/live/me?token=<jwt>` |
| **Media** | `POST /uploads/sign`, `POST /uploads/avatar` |
| **Admin & Settings** | `GET /admin/overview` 🔒, `GET /settings` 🔒, `PATCH /settings` 🔒, `GET /admin/disputes` 🔒, `POST /admin/disputes/{id}/resolve` 🔒, `GET /admin/team` 🔒 |

🔒 = ADMIN-only (enforced by method security). Public catalog reads are open; all mutations require a token.

## Data model

8 core entities — `User`, `Player`, `Franchise`, `Game`, `Match`, `ResultRow`, `Registration`,
`Announcement` — plus supporting tables (`MatchParticipant`, `PlayerGameUsername`,
`PlayerGameProficiency`, `LeagueSettings`, `Dispute`, `RefreshToken`, `AuditLog`). Relationships:
Franchise 1—N Player · Player N—N Game (proficiency) · Match N—N Franchise (participants) ·
Match 1—N ResultRow · Registration 1—1 Player|Squad · Announcement N—1 Match (optional).

## Stack & cross-cutting concerns

| Layer | Choice |
|-------|--------|
| Runtime | Java 21, Spring Boot 3.3 |
| API | REST + JSON, OpenAPI / Swagger UI |
| Persistence | Spring Data JPA — H2 (dev) / PostgreSQL (`postgres` profile) |
| Auth | JWT access (15 min) + rotating refresh, BCrypt, roles PLAYER / FRANCHISE_MANAGER / ADMIN |
| Realtime | WebSocket hub (`/ws/live/**`), in-process pub/sub (Redis-swappable) |
| Scoring | Idempotent recompute of points + standings on result publish, with live emit |
| Ops | `{ code, message, details }` error envelope · admin audit trail · actuator health |

## Test

```bash
mvn test     # SideQuestApiIntegrationTest — 11 end-to-end tests
```

Covers the auth/token flow, registration, RBAC (401 anon / 403 player / 201 admin), the scoring
engine (schedule → publish results → standings recompute + per-match leaderboard), refresh-token
rotation, the admin overview, and the error envelope.

## Layout

```
com.sidequest.arena
├── model/      JPA entities + enums          ├── audit/     admin audit trail
├── repo/       Spring Data repositories      ├── realtime/  WebSocket hub
├── common/     error envelope, pagination    ├── scoring/   standings recompute engine
├── security/   JWT, SecurityConfig, roles    ├── config/    OpenAPI, data seeder
└── <domain>/   auth · players · franchises · games · matches · registrations ·
                standings · announcements · admin   (Controller + Service + dto/ each)
```
