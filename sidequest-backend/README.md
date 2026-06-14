# Side Quest — Backend

A Spring Boot implementation of the **Side Quest Backend Architecture** (the league-platform design
exported from Claude Design). It's a modular REST API for an amateur esports league: players,
franchises, games, matches, registrations, standings, announcements, a realtime hub, and an admin
control room — one API surface shared by the player app and admin panel, separated by role.

> The architecture doc recommends Node/TypeScript; this is the Spring Boot realization of the same
> design (data model, route map, and cross-cutting concerns map 1:1).

## Stack

| Layer            | Choice                                              |
|------------------|-----------------------------------------------------|
| Runtime          | Java 21, Spring Boot 3.3                             |
| API              | REST + JSON, documented with OpenAPI / Swagger UI   |
| Persistence      | Spring Data JPA — **H2** (dev, in-memory) / **PostgreSQL** (prod profile) |
| Auth             | JWT access (15 min) + rotating refresh tokens, BCrypt |
| Realtime         | WebSocket hub (`/ws/live/**`) with in-process pub/sub (Redis-swappable) |
| Scoring/Workers  | `ScoringService` — idempotent recompute + live emit |
| Roles            | `PLAYER`, `FRANCHISE_MANAGER`, `ADMIN`              |

## Run it

```bash
# from this directory (sidequest-backend/)
mvn spring-boot:run
# or
mvn -DskipTests package && java -jar target/sidequest-backend.jar
```

- Base URL: `http://localhost:8080/v1`
- Swagger UI: `http://localhost:8080/v1/docs`
- OpenAPI JSON: `http://localhost:8080/v1/api-docs`
- H2 console (dev): `http://localhost:8080/v1/h2-console` (JDBC `jdbc:h2:mem:sidequest`, user `sa`)

The **dev profile** (default) uses in-memory H2 and seeds a demo league (Season 04). Run against
Postgres with `--spring.profiles.active=postgres` (configure `SPRING_DATASOURCE_*`).

### Demo credentials (password is `password` for every seeded account)

| Email                   | Role              |
|-------------------------|-------------------|
| `admin@sidequest.gg`    | ADMIN             |
| `manager@sidequest.gg`  | FRANCHISE_MANAGER |
| `raghavan@sidequest.gg` | PLAYER            |

```bash
# log in, capture the access token, call a protected route
TOKEN=$(curl -s -X POST localhost:8080/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"identifier":"admin@sidequest.gg","password":"password"}' | jq -r .accessToken)
curl localhost:8080/v1/auth/me -H "Authorization: Bearer $TOKEN"
```

## Test

```bash
mvn test
```

`SideQuestApiIntegrationTest` boots the app on a real port and exercises the seeded catalog, the
auth/token flow, registration, RBAC (401 anon / 403 player / 201 admin), the **scoring engine**
(schedule a match → publish results → standings recompute + per-match leaderboard), refresh-token
rotation, the admin overview, and the error envelope.

## Data model (8 core entities + supporting)

`User`, `Player`, `Franchise`, `Game`, `Match`, `ResultRow`, `Registration`, `Announcement` —
plus `MatchParticipant`, `PlayerGameUsername`, `PlayerGameProficiency`, `LeagueSettings`, `Dispute`,
`RefreshToken`, `AuditLog`. Relationships: Franchise 1—N Player · Player N—N Game (proficiency) ·
Match N—N Franchise (participants) · Match 1—N ResultRow · Registration 1—1 Player|Squad ·
Announcement N—1 Match (optional).

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

## Cross-cutting concerns

- **Auth & roles** — JWT access (15 min) + rotating refresh; three roles enforced on mutating routes.
- **Validation & errors** — bean validation at the edge; consistent envelope `{ code, message, details }`
  with correct HTTP status (`GlobalExceptionHandler`).
- **Scoring engine** — publishing results triggers an idempotent full recompute of franchise/player
  points and ranks, then emits live updates over the WebSocket hub.
- **Pagination & filtering** — cursor pagination (`?limit&cursor`) on list endpoints, with the
  documented filters.
- **Audit** — every admin mutation is written to an append-only audit trail (`AuditService`).

## Layout

```
com.sidequest.arena
├── model/        JPA entities + enums
├── repo/         Spring Data repositories
├── common/       error envelope, exceptions, cursor pagination
├── security/     JWT filter/service, SecurityConfig, role gating
├── audit/        AuditService (admin trail)
├── realtime/     WebSocket hub (config, handler, pub/sub)
├── scoring/      ScoringService (idempotent standings recompute)
├── config/       OpenAPI, DataSeeder
└── <domain>/     auth · players · franchises · games · matches ·
                  registrations · standings · announcements · admin
                  (each: Controller + Service + dto/)
```
