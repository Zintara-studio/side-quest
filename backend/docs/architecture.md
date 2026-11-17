# Architecture

The conceptual big picture of the Side Quest backend — a modular REST API for an amateur esports
league (franchises, players, an auction, matches, standings, seasons). Read this before making
architectural decisions.

**See also:** [./caching-hld.md](./caching-hld.md) (read-cache design) · [../README.md](../README.md)
(run/build) · [../CLAUDE.md](../CLAUDE.md) (working agreement) · `../src/main/resources/application.yml`
(profiles/config) · `../Dockerfile`.

---

## 1. What it is

A single Spring Boot service that owns **every business rule** for the league. The Next.js frontend is
a thin client — it never duplicates scoring, eligibility, or lifecycle logic. Concretely (counts are
from the current tree, `src/main/java/com/sidequest/arena`):

| Metric | Value |
|---|---|
| Language / runtime | Java 21, Spring Boot 3.3.4 (`spring-boot-starter-parent`) |
| Build | Maven via `./mvnw` wrapper |
| Main source | 253 `.java` files |
| REST endpoints | 129 across 15 `*Controller` classes |
| Entities (`model/`) | 34 `@Entity` classes (+ `BaseEntity`), 18 enums |
| Repositories (`repo/`) | 33 Spring Data JPA interfaces |
| Tests | 1 integration file, `SideQuestApiIntegrationTest` — 34 `@Order`-ed end-to-end tests (~1,360 LOC) |

**Key libraries:** `starter-web`, `-data-jpa`, `-security`, `-validation`, `-websocket`, `-actuator`,
`-mail`, `-cache` + Caffeine; **jjwt 0.12.6** (api/impl/jackson) for JWT; **springdoc-openapi 2.6.0**
for `/docs`; **google-api-client 2.7.0** to verify Google id_tokens; **H2** (dev runtime) and
**PostgreSQL** (prod runtime); Lombok. Tests use `spring-boot-starter-test` + `spring-security-test`.

Everything is served under the **`/v1`** context path (`server.servlet.context-path`), so a route
like `AuthController`'s `/auth/login` is externally `POST /v1/auth/login`.

---

## 2. Layered request flow

A request crosses a fixed set of layers. DTOs are Java **records** at the HTTP boundary (each feature
owns a `dto/`); entities never leak past the service layer. Business rules live in services annotated
`@Transactional`; controllers are thin dispatchers.

```
                          HTTP  (Bearer <access-jwt> | ?token= on WS)
                            │
        ┌───────────────────▼─────────────────────────────────────┐
        │ Servlet filter chain (security/)                          │
        │   RequestSizeLimitFilter  → caps raw POST /media body     │
        │   JwtAuthFilter           → parses "access" JWT → sets     │
        │                             UserPrincipal in context       │
        │   SecurityConfig authorizeHttpRequests                     │
        │     public catalog GETs open · /auth/* open · else auth'd  │
        └───────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────▼───────────┐   @PreAuthorize (method security)
        │ *Controller  (@RestController) │   e.g. hasRole('ADMIN') / owner checks
        │   validates @Valid record DTO  │
        └───────────────────┬───────────┘
                            │  DTO in / DTO out
        ┌───────────────────▼───────────┐   @Transactional boundary
        │ *Service   (business rules)    │   pessimistic locks on races,
        │   scoring, lifecycle, auth …   │   emits realtime + notifications
        └───────────────────┬───────────┘
                            │  entities
        ┌───────────────────▼───────────┐
        │ *Repository (Spring Data JPA)  │  → Hibernate → H2 (dev) / Postgres
        └────────────────────────────────┘

  Any thrown ApiException / validation error →  GlobalExceptionHandler (common/)
    → { code, message, details, path, timestamp }   (ApiError record, ErrorCode enum)
```

**Errors** are a single envelope. `ApiException` carries an `ErrorCode` (→ HTTP status:
`VALIDATION_ERROR`/`BAD_REQUEST` 400, `UNAUTHORIZED`/`INVALID_CREDENTIALS`/`TOKEN_*` 401,
`FORBIDDEN`/`EMAIL_NOT_VERIFIED` 403, `NOT_FOUND` 404, `CONFLICT`/`EMAIL_TAKEN` 409, `RATE_LIMITED`
429, `INTERNAL_ERROR` 500). `GlobalExceptionHandler` renders every failure as
`{ code, message, details }` — the frontend keys off `code`, never the prose.

---

## 3. Package-by-feature organization

Code is grouped **by feature, not by layer** — each package owns its `Controller` + `Service` +
`dto/` (and shares `model/` + `repo/`). A new "disputes" concern is one folder, not edits scattered
across a `controllers/`, `services/`, `dtos/` split.

| Package | Files | Owns |
|---|---:|---|
| `model/` | 52 | 34 entities + 18 enums (the shared domain) |
| `repo/` | 34 | Spring Data JPA repositories |
| `matches/` | 21 | fixtures, lineups, rounds, result entry/publish |
| `auth/` | 16 | register / login / OTP / Google / refresh rotation |
| `auctions/` | 15 | auction lobby, lots, bids, pool lock/reset |
| `franchises/` | 15 | franchise CRUD, roster, invites, player tags |
| `admin/` | 10 | admin ops + `SettingsController` (league settings) |
| `players/` | 12 | player profiles, status, game proficiency, username rules, onboarding |
| `registrations/` | 8 | match/pool registration + exclusivity rules |
| `common/` | 7 | error envelope, paging cursors, hashing |
| `games/` | 9 | game catalog + per-game scoring weights + community-vote popularity |
| `standings/` | 6 | league table + leaderboards (read side) |
| `seasons/` | 5 | season lifecycle + frozen snapshots |
| `announcements/` | 5 | announcements with auto-void lifecycle |
| `media/` | 5 | image upload/serve (DB blobs) |
| `security/` | 9 | JWT filter/service, `SecurityConfig`, principals |
| `notifications/` (3) · `realtime/` (3) · `disputes/` (3) · `config/` (3) · `email/` (2) · `scoring/` (1) · `audit/` (1) | | supporting concerns |

**Why:** locality of change (a feature's HTTP surface, rules, and DTOs live together), smaller review
diffs, and clear ownership. The trade-off is that cross-feature reads reach across packages
(`ScoringService` in `scoring/` pulls `Franchise`/`Player`/`ResultRow` from `model/` + `repo/`) — kept
sane because the shared domain (`model/`, `repo/`) is deliberately one layer everyone depends on.

---

## 4. Component overview

```
        Next.js client ──HTTP /v1──▶ Controllers ──▶ Services ──▶ Repos ──▶ DB
              │                                        │  │
              └────WS /v1/ws/live/*──▶ LiveWebSocketHandler │  ├─ ScoringService  (recompute on publish)
                                          │                 │  ├─ SeasonService   (finish/start snapshots)
                                    RealtimeService◀─────────┘  ├─ AuthService     (jjwt + BCrypt + Google)
                                    (in-proc pub/sub)           ├─ NotificationService
                                                                ├─ EmailService (SMTP or console OTP)
                                                                ├─ AuditService  (AuditLog)
                                                                └─ Caffeine cache (evict-on-write)
```

---

## 5. Auth model

Stateless JWT. `security/SecurityConfig` sets `SessionCreationPolicy.STATELESS`, disables CSRF (no
cookies), and gates routes: infra/docs + `/auth/*` are public, public catalog **GET**s
(`/players`, `/franchises`, `/games`, `/matches`, `/standings`, `/leaderboard`, `/announcements`,
`/seasons`, `/auctions`, `/media`) are open so the player app browses unauthenticated, and everything
else needs a valid token. Fine-grained admin/owner gating is per-route `@PreAuthorize` under
`@EnableMethodSecurity`.

- **Tokens.** `AuthService` issues a short-lived **access JWT** (TTL **1h**, config-driven via
  `sidequest.jwt.access-token-ttl-seconds`) carrying `sub`/`email`/`role`/`typ:"access"`, signed by
  `JwtService` (jjwt). `JwtAuthFilter` only trusts tokens whose `typ` is `access`. **Refresh tokens**
  are opaque random secrets stored **only as SHA-256 hashes** (`RefreshToken` entity), TTL **30d**,
  and **rotated on every `/auth/refresh`**.
- **Passwords** are BCrypt (`BCryptPasswordEncoder` bean). Google-only accounts get a random,
  unusable password hash.
- **Email verification (OTP).** `/auth/register` never returns a session; the user must confirm a
  one-time code (`OtpCode` + `OtpPurpose.VERIFY_EMAIL`). `verifyEmail` marks the user verified **and
  promotes their `Player` to `PlayerStatus.VERIFIED`** (the auction-eligibility gate). Password reset
  reuses the same OTP machinery (`OtpPurpose.RESET_PASSWORD`) and revokes all refresh tokens.
- **Google sign-in.** `/auth/google` verifies the id_token server-side (`GoogleTokenVerifier`,
  google-api-client) — signature/audience/issuer/exp — then finds-or-creates the user. Empty client-id
  in dev → clean "not configured" error, frontend hides the button. A **first-time** Google account is
  created with a throwaway placeholder gamerTag + `Player.onboardingRequired=true` (the Google display
  name is *never* silently adopted as the immutable handle); it must claim a real username via
  `POST /players/onboard` — the one path allowed to set a gamerTag after creation, and only while the
  flag is set. Both `register()` and `onboard()` validate the handle via `players/UsernameRules`
  (no spaces, 3–20 chars, case-insensitive uniqueness), with a live check at `GET /players/username-available`.
- **Roles + admin tier.** `Role` = `PLAYER`, `FRANCHISE_MANAGER`, `FRANCHISE_OWNER`, `ADMIN` → Spring
  authorities `ROLE_<name>`. `AdminLevel` (`NONE`/`ADMIN`/`SUPER_ADMIN`) is **orthogonal to role**: the
  principal emits `ROLE_ADMIN` at level ≥ ADMIN and `ROLE_SUPER_ADMIN` for the single main admin, so
  sensitive areas (auction, franchise management, admin appointment) gate on `hasRole('SUPER_ADMIN')`.
  `AuthRateLimiter` throttles login/OTP endpoints (`RATE_LIMITED`).
- **Profile edits are owner-only.** `PlayerService.update` forbids editing another player's profile even
  for admins — admins and franchise leaders may *view* every field (the account email is surfaced only
  to such privileged viewers), but only the owner mutates it; admin-only account actions (status changes)
  are separate endpoints.

---

## 6. Scoring engine (`scoring/ScoringService`)

Triggered by an admin publishing a match result (`onResultsPublished`). It is a **full, idempotent
recompute** — it never applies deltas, so re-running after a dispute correction or a match void always
converges to the same state.

- **Franchise points are season-scoped.** `recomputeStandings()` reads the **ACTIVE** season code,
  then one aggregate query (`aggregateFranchisePoints`) returns each franchise's per-game-**weighted**
  total for that season (excluding cancelled fixtures). Rounding happens **once per franchise** (not
  per row — fractional weights like a 0.75× title would otherwise drift), and totals saturate into the
  int column range. Ranks are points-desc, name-tiebreak. A **new season starts from a clean slate**.
- **Player points are a career total.** They are **not** season-scoped: summed from a player's kills
  in franchise matches (weighted by each match's `pointsPerKill`) plus their FFA result totals, across
  **all** seasons — so they accumulate and survive franchise resets. A `franchise != null` guard keeps
  the two aggregate sources disjoint (no double counting).
- **Season-freeze invariant (the load-bearing rule).** The franchise table is recomputed **only while
  a season is ACTIVE**. Off-season (a finished season, no successor started) the franchises still carry
  the just-finished season's points, so a later scoring-weight edit or a match void must **not**
  retroactively re-weight them — the block is skipped and the finished season's standings stay a frozen
  snapshot. Player career points recompute unconditionally (they aren't season-scoped).

After recompute it pushes the per-match result table and the fresh standings to the realtime hub and
evicts the read caches.

---

## 7. Season lifecycle (`seasons/SeasonService`)

```
   dev seed (DataSeeder: Season 04 / code "S04")
        │
     ACTIVE ── admin finish() ──▶ FINISHED (snapshot → SeasonStanding rows, frozen)
        ▲                              │
        │                          off-season  (finished, no successor; live franchise
        │                          points still show the last season — never re-weighted)
        └── admin start(req) ◀────────┘   requires the current season be FINISHED first;
             new season becomes current, franchise points reset to a clean slate
```

- **finish()** snapshots the active season's final franchise standings into `SeasonStanding` (frozen
  history) and marks it `FINISHED`. Idempotent per season; 409 if nothing is active.
- **start()** deliberately **refuses** to silently end a running season — the current one must be
  finished first, preserving the intended off-season workflow (finish → keep/discard franchises →
  auction → rosters → start). The new season becomes current.
- **All-time standings** = frozen `SeasonStanding` history from every finished season **plus** live
  points, with an explicit guard so off-season points aren't double-counted (they already live in both
  the frozen snapshot and the live franchise row).

---

## 8. Concurrency model

Check-then-act races are serialized with **pessimistic row locks + DB unique constraints** — there is
**no `@Version`/optimistic locking**. The losing transaction re-reads committed state and hits the
normal 409 guard.

| Race | Lock (`@Lock(PESSIMISTIC_WRITE)`) | Why |
|---|---|---|
| Season finish / start | `LeagueSettingsRepository.lockById` (settings singleton) | two transitions serialize on one existing row → no double-snapshot / double-start |
| Result publish | `MatchRepository.findByIdForUpdate` | the delete-then-insert result rewrite is only idempotent one-at-a-time; interleaved publishes would both see no committed rows and double every total |
| Registration exclusivity | `PlayerRepository.lockById` | one-team-per-match / one-pool-entry guards serialize per player |
| OTP consume | `OtpCodeRepository` (PESSIMISTIC_WRITE) | single-use codes can't be redeemed twice |
| Game-popularity recompute | app-level `ReentrantLock` + `TransactionTemplate` (held **across** the commit) | popularity is a pure function of committed vote rows; the lock spans commit so the next voter's recompute always reads the previous voter's votes and converges (single-node; a multi-node deploy would swap for a DB advisory lock) |

Unique constraints back-stop the locks at the schema level (e.g. `MatchParticipant`, `MatchLineup`,
`AuctionLot`, `AuctionFranchise`, `PlayerGameProficiency`, `GameVote` (`user`,`game`), `Player`, `User`, `Season`, `RefreshToken`).

**Pretty-URL slugs.** `Player` (gamerTag), `Franchise` (tag), `Match` (`slug`, `@PrePersist`
`game-date-hex`), `Announcement` (`shortCode`) resolve by **slug OR uuid** at every read seam
(`resolveMatchId`, `PlayerService.resolve`, `findByShortCode(...).or(uuid)`, …). The UI emits clean URLs
while old stored links (e.g. a dispute notification's `/match/{uuid}`) still resolve — the dual resolver
is kept deliberately for that backward compatibility.

---

## 9. Realtime WebSocket hub (`realtime/`)

A **raw** WebSocket hub (not STOMP), registered by `WebSocketConfig` under `/ws/live/**` — effective
URLs keep the `/v1` context path (`wss://host/v1/ws/live/...`). `RealtimeService` is an **in-process**
`ConcurrentHashMap` topic → sessions pub/sub; the class javadoc marks it as the seam where a Redis
pub/sub fan-out would slot in for multi-instance.

| Channel | Topic | Auth |
|---|---|---|
| `/ws/live/standings` | `standings` | open (public leaderboard ticks) |
| `/ws/live/matches/{id}` | `match:{id}` | open (live scores) |
| `/ws/live/auctions/{id}?token=<jwt>` | `auction:{id}` | **bidders + admins only** |
| `/ws/live/me?token=<jwt>` | `me:{userId}` | the authenticated user |

The HTTP layer permits `/ws/**`; **auth happens at the handshake** in `LiveWebSocketHandler`. Because
browsers can't set headers on a WS handshake, the JWT rides in the **`?token=` query param**, parsed
via `JwtService`. The **auction channel is bidders-only**: it validates the token then calls
`auctionService.canWatchLive(auctionId, userId, isAdmin)` — spectators are refused with
`POLICY_VIOLATION` and fall back to polling. `ping`→`pong` heartbeats are supported.

---

## 10. Caching (`config/CacheConfig`)

Caffeine, in-process, **evict-on-write**. Six caches (`games`, `standings`, `leaderboard-players`,
`game-rankings`, `franchises`, `players`), 45s write-TTL, max 500 entries — only the hottest **public
read** paths; per-user / mutating endpoints are never cached. Writes that change the data (result
publish → standings recompute, game edits, **a game-popularity vote** — which recomputes every game's
derived popularity) fire `@CacheEvict(allEntries=true)`. Rationale and the staleness argument live in
**[./caching-hld.md](./caching-hld.md)** — not duplicated here.

**Bounded background sweeps** (`@EnableScheduling`): expired refresh tokens, old notifications, old
non-pinned announcements, and — newest — the **append-only `AuditLog`** (a daily `AuditService.purgeOld`
deletes entries past the retention window, currently 7 days) are all reaped so no table grows unbounded.

## 11. Media as DB blobs

Images (avatars, franchise logos, banners) are stored **inline in the database** as `byte[]`
(`MediaAsset`), **not** S3/object storage. The column is a plain `byte[]` with an explicit length (not
`@Lob`) so it maps to `VARBINARY` on H2 and `bytea` on Postgres, avoiding Postgres large-object (oid)
handling. `RequestSizeLimitFilter` caps the raw `POST /media` body before anything buffers it
(heap-exhaustion guard; per-kind caps up to ~256KB banners). Trade-off: simple and portable, but blobs
sit in row storage and stream through the app — fine at league scale, would move to object storage if
media volume grew.

---

## 12. Profiles (`application.yml`)

| | `dev` (default) | `postgres` |
|---|---|---|
| Datasource | in-memory **H2** (`MODE=PostgreSQL`) | **PostgreSQL** + Hikari pool (max 10, 5s timeout, 30s leak detection) |
| Schema | `ddl-auto: create-drop` | `ddl-auto: update` (additive only; Flyway is the noted next step) |
| Seed | `DataSeeder` demo league (**Season 04**, all passwords `password`) | none |
| JWT secret | committed dev-only fallback (logs a warning) | **required env** — fails fast at startup if unset |
| SMTP | optional; unset → `EmailService` logs the OTP to stdout | required outside dev (else OTPs would leak to logs) |
| Proxy | — | `forward-headers-strategy: native` (honour `X-Forwarded-*` behind an ALB) |
| Swagger `/docs` | on | off (`api-docs`/`swagger-ui` disabled) |

**Docker:** multi-stage `Dockerfile` (maven build → `temurin-21-jre` runtime), runs as **uid 1000**
(Hugging Face Spaces convention), `HEALTHCHECK` curls `/v1/actuator/health`, defaults to the `dev`
profile so the image is self-contained. `docker-compose.yml` at the workspace root wires
db + backend + frontend (+ optional MailHog).

---

## 13. Limitations (honest)

- **Realtime is single-instance.** `RealtimeService` fan-out is in-process; horizontal scaling needs
  the documented Redis-pub/sub swap. WS handshake auth via `?token=` also means the token can appear
  in server access logs — acceptable for short-lived access tokens, not ideal.
- **Schema migrations are `ddl-auto: update` in prod** — additive only. Anything non-additive (renames,
  drops, backfills) needs Flyway first; this is called out in `application.yml`, not yet wired.
- **Test coverage is one end-to-end suite** (34 ordered tests) — high on integration confidence for the
  golden paths, thin on isolated unit tests for edge branches.
- **Media in-DB** doesn't scale to large/high-volume assets (§11).
- **No distributed locking** — the pessimistic-lock races (§8) are correct within one DB but assume a
  single writer DB (true today).

---

## 14. Build · run · test

```bash
./mvnw spring-boot:run              # dev profile: H2 + seeded Season 04, Swagger at /v1/docs
./mvnw test                         # SideQuestApiIntegrationTest (34 ordered e2e tests)
./mvnw -DskipTests clean package    # → target/sidequest-backend.jar
SPRING_PROFILES_ACTIVE=postgres ... # prod-ish: needs SIDEQUEST_JWT_SECRET + Postgres + SMTP
```

Living reference — keep counts and rules in sync with the code when they change.
