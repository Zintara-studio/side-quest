# Project structure & layout

Where the code lives: a package-by-feature map of the Side Quest backend, so a new developer can find
the right file before touching anything.

**See also:** [../CLAUDE.md](../CLAUDE.md) (index + operating rules) ·
[./architecture.md](./architecture.md) (request flow, auth, scoring, concurrency, realtime) ·
[./data-model.md](./data-model.md) (entities, relationships, invariants) ·
[./tech-stack.md](./tech-stack.md) (stack + versions + rationale) ·
[./caching-hld.md](./caching-hld.md) (cache design) ·
[./setup.md](./setup.md) · [./testing.md](./testing.md) · [./troubleshooting.md](./troubleshooting.md) ·
[./status.md](./status.md).

---

## At a glance

| Metric | Value |
|--------|-------|
| Language / runtime | Java 21, Spring Boot 3.3.4 (via `spring-boot-starter-parent`) |
| Build | Maven (`./mvnw` wrapper); single module `sidequest-backend:1.0.0` |
| Main source files | 238 `.java` files, ~16,820 LOC under `com.sidequest.arena` |
| Feature packages | 14 domains, each `Controller + Service + dto/` |
| REST controllers | 15 `*Controller` classes → **118** endpoints, all under context path `/v1` |
| Persistence | ~33 `@Entity` classes (+ a `BaseEntity` mapped-superclass), 17 enums, 33 Spring Data repositories |
| Realtime | raw WebSocket hub at `/ws/live/**`, in-process pub/sub |
| Tests | 1 integration file (`SideQuestApiIntegrationTest`), 26 `@Order`-ed end-to-end tests (~1,100 LOC) |

Everything hangs off one entry point, `SideQuestApplication` (`@SpringBootApplication`,
`@EnableAsync`, `@EnableScheduling`), which also logs a loud banner when the `dev` profile boots so a
misconfigured prod box announces that it is serving in-memory demo data.

---

## Repo root layout

```
SideQuests arena backend/
├── pom.xml                 Maven build — Spring Boot parent 3.3.4, Java 21, deps
├── mvnw / mvnw.cmd / .mvn  Maven wrapper (build without a system Maven)
├── Dockerfile              Multi-stage build (maven → temurin-21-jre), runs as uid 1000
├── .dockerignore
├── .env.example            Documented env vars for the postgres profile / Docker
├── CLAUDE.md               Index + operating rules for this repo (read first)
├── README.md               Overview + quick start
├── docs/                   This doc set (architecture, data-model, setup, testing, …)
└── src/
    ├── main/
    │   ├── java/com/sidequest/arena/   All application code (see tree below)
    │   └── resources/application.yml   The only config file (profiles dev + postgres)
    └── test/java/com/sidequest/arena/
        └── SideQuestApiIntegrationTest.java
```

Note: `application.yml` is the sole file in `src/main/resources`; `.env.example` and `Dockerfile` live
at the repo root. `docker-compose.yml` (db + backend + frontend + optional mailhog) lives one level up
at the workspace root, since it wires this repo to its sibling frontend.

---

## Package tree (`com.sidequest.arena`)

File counts are recursive (they include each feature's `dto/` subpackage).

```
com.sidequest.arena
├── SideQuestApplication.java        Entry point; @EnableAsync/@EnableScheduling; dev-profile warning
│
│  ── FEATURE PACKAGES (Controller + Service + dto/) ──
├── auth/            (16)  Register/login, email-OTP verify, Google Sign-In, JWT refresh/logout
├── players/          (9)  Player profiles, per-game usernames, status, privacy
├── franchises/      (15)  Teams: branding, roster, roles, invites, franchise match views
├── games/            (6)  Game catalog + per-game config
├── matches/         (21)  Matches, lineups, rounds, per-round results, live match room + chat
├── registrations/    (8)  Season registration (apply / invite / review), withdrawal, locks
├── auctions/        (15)  Pre-season player auction: lots, bids, funds, nomination, sweep
├── seasons/          (5)  Season lifecycle (start / finish) + frozen standings snapshots
├── standings/        (6)  Public leaderboards: franchise table, per-game + per-player ranks
├── announcements/    (5)  League announcements (categorized, lifecycle)
├── disputes/         (3)  Player/manager-filed disputes
├── notifications/    (3)  In-app notification feed
├── media/            (5)  Image upload/serve as DB blobs (avatars, logos, banners)
├── admin/           (10)  Admin control room (AdminController) + league SettingsController
│
│  ── CROSS-CUTTING PACKAGES ──
├── model/           (51)  JPA entities (~33) + enums (17) + BaseEntity mapped-superclass
├── repo/            (33)  Spring Data JPA repository interfaces (one per aggregate)
├── common/           (7)  Error envelope, ApiException, pagination cursors, hashing helpers
├── security/         (9)  JWT filter, SecurityConfig, method security, SecurityUtils, size-limit filter
├── config/           (3)  DataSeeder, CacheConfig (Caffeine), OpenApiConfig
├── realtime/         (3)  WebSocket hub handler + in-process pub/sub + registration
├── email/            (2)  SMTP sender + email service (OTP/notification mail)
├── audit/            (1)  AuditService — writes AuditLog rows for sensitive actions
└── scoring/          (1)  ScoringService — recompute-from-history standings engine
```

Sums to 238 files: 127 across the 14 feature packages, 110 across the cross-cutting packages, plus the
top-level `SideQuestApplication`.

---

## The per-feature convention

Every domain is a self-contained package holding its own HTTP layer, business logic, and boundary
types — never a project-wide `controllers/` or `services/` split:

```
<feature>/
├── <Feature>Controller.java   Thin HTTP layer: routing, @PreAuthorize, @Valid, DTO in/out
├── <Feature>Service.java      Business rules, transactions, entity ↔ DTO mapping
└── dto/                       Request/response records at the API boundary (entities never leak)
```

Concrete example — `matches/` (21 files):

```
matches/
├── MatchController.java        @RequestMapping("/matches"), 18 endpoints, mostly @PreAuthorize("hasRole('ADMIN')")
├── MatchService.java           Match lifecycle, lineups, round results, room + chat, publish
└── dto/                        19 records:
    ├── CreateMatchRequest, UpdateMatchRequest, RescheduleMatchRequest, StartMatchRequest
    ├── SetLineupRequest, EnterRoundsRequest, EnterResultsRequest, PostMatchMessageRequest
    ├── MatchSummary, MatchDetail, MatchRoomView, MatchLineupView, MatchRoundView
    ├── MatchPlayerView, ParticipantView, ResultEntry, ResultView, MatchMessageView, GameMini
```

A few features carry an extra collaborator alongside the Controller/Service pair, kept in the same
package so the mechanism stays local to the feature that owns it:

| Package | Extra collaborators | Why |
|---------|--------------------|-----|
| `auth/` | `OtpService`, `GoogleTokenVerifier`, `AuthRateLimiter` | Email-OTP issuance, Google id_token verification, per-IP auth throttling |
| `auctions/` | `AuctionSweepService` | Scheduled sweep of expired/idle lots |
| `registrations/` | `RegistrationLockService` | Pessimistic row locking for registration exclusivity |
| `players/` | `PlayerProfileWriter` | Isolates the profile-write path (media refs, privacy) |
| `media/` | `MediaRefs` | Validates/normalizes image-reference fields against `/media/{uuid}` |
| `admin/` | second controller `SettingsController` + `SettingsService` | League-wide `LeagueSettings` administration |

REST surface per controller (all mounted under context path `/v1`):

| Controller | Base path | Endpoints |
|------------|-----------|-----------|
| FranchiseController | `/franchises` | 21 |
| AuctionController | `/auctions` | 20 |
| MatchController | `/matches` | 18 |
| RegistrationController | `/registrations` | 11 |
| AuthController | `/auth` | 10 |
| SeasonController | `/seasons` | 6 |
| PlayerController | `/players` | 6 |
| AnnouncementController | `/announcements` | 6 |
| NotificationController | `/notifications` | 4 |
| AdminController | `/admin` | 4 |
| StandingsController | (per-method paths) | 3 |
| GameController | `/games` | 3 |
| SettingsController | `/settings` | 2 |
| MediaController | `/media` | 2 |
| DisputeController | `/disputes` | 2 |

Total: 118 endpoints across 15 controllers.

---

## Cross-cutting packages in detail

### `model/` — entities + enums (51 files)

JPA aggregates plus the shared `BaseEntity` (`@MappedSuperclass`: UUID `@Id`, `created_at` / `updated_at`
maintained by JPA lifecycle callbacks). ~33 `@Entity` classes:

`User`, `Player`, `Franchise`, `Game`, `Match`, `MatchParticipant`, `MatchLineup`, `MatchRound`,
`MatchRoundResult`, `MatchRoundPlayerResult`, `MatchMessage`, `ResultRow`, `Registration`, `TeamInvite`,
`FranchiseInvite`, `Announcement`, `Auction`, `AuctionFranchise`, `AuctionLot`, `AuctionBid`, `Season`,
`SeasonStanding`, `PlayerFranchiseHistory`, `FranchisePlayerTag`, `PlayerGameProficiency`,
`PlayerGameUsername`, `Notification`, `Dispute`, `MediaAsset`, `LeagueSettings`, `RefreshToken`,
`OtpCode`, `AuditLog`.

17 enums keep status/type values type-safe: `Role`, `PlayerStatus`, `GameType`, `MatchStatus`,
`MatchType`, `RegistrationType`, `RegistrationStatus`, `AuctionStatus`, `AuctionLotStatus`,
`SeasonStatus`, `DisputeStatus`, `DisputeCategory`, `NotificationType`, `AnnouncementCategory`,
`InviteStatus`, `FranchiseRole`, `OtpPurpose`. (Full relationships + invariants in
[./data-model.md](./data-model.md).)

### `repo/` — persistence (33 files)

One Spring Data JPA repository per aggregate (e.g. `PlayerRepository`, `MatchRepository`,
`AuctionBidRepository`, `SeasonStandingRepository`, `RefreshTokenRepository`, `AuditLogRepository`).
Custom finders include pessimistic-lock methods (`findByIdForUpdate` / `lockById`) that close the
check-then-act races called out in `CLAUDE.md` (season start/finish on `LeagueSettings`, result publish
on `Match`, registration exclusivity on `Player`). There is intentionally no `@Version` optimistic
locking.

### `common/` — shared boundary primitives (7 files)

| File | Role |
|------|------|
| `ApiError` | The `{ code, message, details }` envelope record (plus `path` + `timestamp` for ops) |
| `ApiException` | App exception carrying an `ErrorCode` + optional structured `details` |
| `ErrorCode` | Stable machine-readable codes mapped to `HttpStatus` (e.g. `EMAIL_NOT_VERIFIED` → 403, `RATE_LIMITED` → 429) |
| `GlobalExceptionHandler` | `@RestControllerAdvice` translating every exception into the envelope |
| `PageResponse<T>` | Cursor-pagination envelope: `{ items, nextCursor, limit }` |
| `Cursors` | Opaque Base64 offset cursors; `DEFAULT_LIMIT=20`, `MAX_LIMIT=100` |
| `Hashing` | `sha256Hex` helper (e.g. token / opaque-value hashing) |

### `security/` — authentication & authorization (9 files)

JWT Bearer auth (jjwt) + BCrypt passwords + role-based method security (`@EnableMethodSecurity` +
`@PreAuthorize`), roles `PLAYER` / `FRANCHISE_MANAGER` / `ADMIN`.

| File | Role |
|------|------|
| `JwtService`, `JwtProperties` | Sign/verify access + refresh tokens; TTLs (access 1h, refresh 30d) |
| `JwtAuthFilter` | `OncePerRequestFilter` reading `Authorization: Bearer`, populates the `SecurityContext` |
| `SecurityConfig` | Filter chain, stateless sessions, CORS, BCrypt encoder, public-vs-authenticated routes |
| `SecurityUtils` | Static accessors for the current `UserPrincipal` (ownership checks) |
| `UserPrincipal` | Authenticated principal (user id + role) |
| `RestAuthEntryPoint`, `RestAccessDeniedHandler` | 401 / 403 responses in the standard error envelope |
| `RequestSizeLimitFilter` | Caps raw body size on `POST /media` to bound heap use before validation |

### `config/` — Spring wiring (3 files)

| File | Role |
|------|------|
| `DataSeeder` | `dev`-only demo league seed (Season 04) — franchises, games, matches, an auction, disputes, etc. |
| `CacheConfig` | `@EnableCaching` + Caffeine manager, ~45s TTL on hot public reads; see [./caching-hld.md](./caching-hld.md) |
| `OpenApiConfig` | OpenAPI metadata + bearer-JWT scheme; Swagger UI at `/v1/docs` (disabled in `postgres`) |

### `realtime/` — WebSocket hub (3 files)

Raw WebSocket (not STOMP) under `/ws/live/**`. `WebSocketConfig` registers `LiveWebSocketHandler`,
which maps a connection's path to a topic — `standings`, `matches/{id}`, `auctions/{id}`, `me` — and
`RealtimeService` is an in-process (`ConcurrentHashMap`) pub/sub that fans server-side events out to
subscribed sessions. Single-instance only (see Limitations).

### Small support packages

- `email/` (2) — `EmailSender` + `EmailService`; SMTP is env-driven, and unset SMTP in `dev` falls back
  to logging OTPs to the console. Outside `dev` the app fails fast without SMTP config.
- `audit/` (1) — `AuditService` writes `AuditLog` rows for sensitive / admin actions.
- `scoring/` (1) — `ScoringService`, the idempotent recompute-from-history standings engine
  (re-derives everything from retained `ResultRow`s; never accumulates deltas).

---

## Configuration & profiles (`src/main/resources/application.yml`)

Two Spring profiles in one YAML file:

| Profile | Datasource | Schema | Seed |
|---------|-----------|--------|------|
| `dev` (default) | in-memory H2 (`MODE=PostgreSQL`) | `ddl-auto: create-drop` | demo league via `DataSeeder` |
| `postgres` | PostgreSQL (HikariCP pool) | `ddl-auto: update` (additive only) | none |

Shared config: context path `/v1`, JWT (access 1h / refresh 30d, issuer `sidequest.gg`), Caffeine
caches, `open-in-view: false`, response compression, actuator health (the mail probe is disabled so
best-effort SMTP can't flip liveness). The `postgres` profile adds
`server.forward-headers-strategy: native` (behind an ALB) and **fails fast** if `SIDEQUEST_JWT_SECRET`
is unset — no fallback to the committed dev secret. The full env-var reference lives in `.env.example`.

---

## Where to add a feature

1. New package `com.sidequest.arena.<feature>` with `<Feature>Controller` + `<Feature>Service` + `dto/`.
2. Entities → `model/`; repository → `repo/`. Validate requests with `@Valid` + jakarta annotations;
   never return entities — map to `dto/` records.
3. Errors via `ApiException` + an `ErrorCode` (add one if needed) — the global handler does the rest.
4. Secure mutations with `@PreAuthorize`; read the current user through `SecurityUtils`.
5. Public read-heavy paths: consider a Caffeine cache + `@CacheEvict` on the writes that change it.
6. Extend the 26-test integration suite; keep `./mvnw test` green.

(Full conventions + checklist in [../CLAUDE.md](../CLAUDE.md).)

---

## Limitations

- **Single-instance realtime & cache.** `RealtimeService` pub/sub and the Caffeine cache are in-process;
  horizontal scaling would need an external broker (e.g. Redis pub/sub) and a shared cache.
- **Media in the database.** `MediaAsset` stores image bytes as a DB blob, not object storage (S3) — fine
  at league scale, not for large media volumes.
- **Schema evolution is additive.** `postgres` runs `ddl-auto: update`; anything non-additive should move
  to a migration tool (Flyway is the noted next step). No migration scripts exist yet.
- **One integration test file.** Coverage is end-to-end and ordered (26 tests) rather than broad unit
  coverage; individual services lack isolated unit tests.
