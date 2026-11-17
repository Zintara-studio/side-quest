# Project status — where it's at

An honest, quantified inventory of the Side Quest backend: what is built and working, what has been hardened, and what is deliberately not done yet. Read this first to calibrate expectations before diving into the code.

**See also:** [./caching-hld.md](./caching-hld.md) (caching design) · [../README.md](../README.md) (run/deploy) · [../CLAUDE.md](../CLAUDE.md) (working agreement & philosophy)

---

## At a glance

| Metric | Value | Source |
|---|---|---|
| Language / runtime | Java 21 | `pom.xml` (`java.version` = 21) |
| Framework | Spring Boot 3.3.4 | `spring-boot-starter-parent` |
| Build | Maven via `./mvnw` wrapper | `mvnw`, `.mvn/` |
| Main source files | 253 `.java` | `src/main/java` |
| REST controllers | 15 (`*Controller`) | + 1 `@RestControllerAdvice` global handler |
| REST endpoints | 129 | `@{Get,Post,Put,Patch,Delete}Mapping` count |
| JPA entities | 34 `@Entity` + 1 `@MappedSuperclass` (`BaseEntity`) | `model/` |
| Enums | 18 | `model/` |
| Spring Data repositories | 34 | `repo/` |
| Integration tests | 34 ordered end-to-end (`SideQuestApiIntegrationTest`, ~1,360 LOC) | `src/test` |

All controller routes sit under the `/v1` context path (`server.servlet.context-path: /v1`).

> **Framing:** this is **production-ready pending a staging deploy pass** — feature-complete for the league flows below, hardened for correctness and scale, and validated on the PostgreSQL profile end-to-end. What it has *not* had is a real staging environment, a load test, or a schema-migration tool. It is not "done"; it is "ready to be proven in staging."

---

## Stack & dependencies

Everything below is a declared dependency in `pom.xml` — no hidden runtime magic.

- **Web / API:** `spring-boot-starter-web`, `spring-boot-starter-validation`, `springdoc-openapi-starter-webmvc-ui` 2.6.0 (Swagger UI at `/docs`, disabled on the `postgres` profile).
- **Persistence:** `spring-boot-starter-data-jpa`; `h2` (dev, `runtime`), `postgresql` (prod, `runtime`).
- **Security / auth:** `spring-boot-starter-security`; `jjwt` 0.12.6 (`api` compile + `impl`/`jackson` runtime); `google-api-client` 2.7.0 (server-side Google `id_token` verification).
- **Realtime:** `spring-boot-starter-websocket` (raw `WebSocketHandler`, not STOMP).
- **Caching:** `spring-boot-starter-cache` + Caffeine (in-process, TTL'd — see [caching-hld.md](./caching-hld.md)).
- **Ops / mail:** `spring-boot-starter-actuator`, `spring-boot-starter-mail`.
- **Boilerplate:** Lombok (annotation-processor only; excluded from the fat jar).
- **Test:** `spring-boot-starter-test`, `spring-security-test`, Apache `httpclient5` (the JDK client throws `HttpRetryException` on 401 POSTs).

App-level switches live on `SideQuestApplication`: `@SpringBootApplication`, `@EnableAsync` (async email/notifications), `@EnableScheduling` (bounded background sweeps).

---

## Built & working

Package-by-feature under `com.sidequest.arena`; each feature owns its `Controller` + `Service` + `dto/`. File counts per feature package:

| Package | Files | Package | Files |
|---|---|---|---|
| `model` | 51 | `players` | 9 |
| `repo` | 33 | `security` | 9 |
| `matches` | 21 | `registrations` | 8 |
| `auth` | 16 | `common` | 7 |
| `auctions` | 15 | `games` | 6 |
| `franchises` | 15 | `standings` | 6 |
| `admin` | 10 | `announcements` | 5 |
| `seasons` | 5 | `media` | 5 |
| `notifications` | 3 | `disputes` | 3 |
| `realtime` | 3 | `config` | 3 |
| `email` | 2 | `audit` | 1 |
| `scoring` | 1 | | |

### Feature checklist

**Auth** (`AuthController`, 10 endpoints)
- [x] Register / verify email (OTP) / login / refresh (rotating refresh tokens) / logout
- [x] Google Sign-In (`id_token` verified server-side; button hidden when `client-id` unset)
- [x] **First-time SSO onboarding:** a fresh Google account is parked with a placeholder gamerTag +
      `Player.onboardingRequired=true` and must claim a real username via `POST /players/onboard` before
      it is usable — it never silently adopts the Google display name as the immutable handle
- [x] OTP flows and forgot / reset password
- [x] JWT Bearer (jjwt), BCrypt hashing, roles `PLAYER` / `FRANCHISE_MANAGER` / `ADMIN` via `@EnableMethodSecurity` + `@PreAuthorize`; `AdminLevel` (NONE/ADMIN/SUPER_ADMIN) orthogonal to role

**Players** (`PlayerController`, 8 endpoints)
- [x] Profiles with **per-field privacy** controls; the account (login) email is surfaced only to a
      privileged viewer (owner / admin / the player's franchise owner-manager)
- [x] **Profile edit is owner-only** — admins and franchise leaders may *view* every field but may not
      edit another player's profile (only admin-scoped account actions like status changes are theirs)
- [x] **Username rules** (`players/UsernameRules`): no spaces, 3–20 chars, case-insensitive uniqueness
      (`sammy` == `Sammy`); live availability check at `GET /players/username-available`
- [x] Per-game proficiency and per-game usernames (`PlayerGameProficiency`, `PlayerGameUsername`)
- [x] Avatar / media on the profile (DB-blob, see Media)

**Franchises** (`FranchiseController`, 21 endpoints)
- [x] Franchises + rosters, branding/logo
- [x] Franchise player tags (`FranchisePlayerTag`)
- [x] Ownership/manager invites (`FranchiseInvite`) with accept/reject/re-open handshake
- [x] Franchise history (`PlayerFranchiseHistory`)

**Games & scoring** (`GameController`, 6 endpoints; `scoring/`)
- [x] Game catalog with per-game **scoring configuration** (`GameType`, per-game rules)
- [x] **Community-driven popularity** (`GameVote`, `GameVoteService`): any signed-in user upvotes games
      (`PUT /games/votes`, `GET /games/my-votes`); a game's `popularity` is derived as
      `round(100 × distinct voters for it / distinct voters overall)` — no longer admin-set

**Matches** (`MatchController`, 18 endpoints)
- [x] Schedule, match room, lineups, rounds, per-round + per-player results
- [x] Full lifecycle incl. void and delete of completed matches
- [x] In-room chat (`MatchMessage`)

**Registrations** (`RegistrationController`, 11 endpoints)
- [x] Solo / squad / FFA registration (`RegistrationType`)
- [x] Squad invites (`TeamInvite`) with captain re-invite
- [x] Self-service withdrawal (`WITHDRAWN` status)

**Auctions** (`AuctionController`, 21 endpoints)
- [x] Draft → lobby → live bidding → assign → re-auction → complete
- [x] Franchise funds/budgets, cancel, and **restart recovery**
- [x] Live bid updates over WebSocket (`/ws/live/auctions/{id}`)
- [x] **Standing pool visible without an auction** (`GET /auctions/pool`): the AUCTION-registration
      entrants (ACTIVE, un-consumed, un-rostered) can be scouted even before an auction is created

**Seasons & standings** (`SeasonController` 6, `StandingsController` 3 endpoints)
- [x] Season finish / start / **freeze** (prior seasons are frozen; the franchise table only recomputes while a season is `ACTIVE`) and all-time views
- [x] Standings + leaderboards (`SeasonStanding`)

**Announcements, disputes, notifications, admin, settings**
- [x] Announcements + registration calls (`AnnouncementController`, 6 endpoints)
- [x] Disputes (`DisputeController`, 2 endpoints; `DisputeCategory`/`DisputeStatus`)
- [x] Notifications (`NotificationController`, 4 endpoints; `NotificationType`)
- [x] Admin control room (`AdminController`, 6 endpoints) + settings (`SettingsController`, 2 endpoints; `LeagueSettings`); the main admin can appoint/revoke appointed admins, seed static config, and set their own account avatar (`PATCH /admin/profile/avatar` — the league admin has no player, so the avatar lives on `User.avatarUrl`)
- [x] Audit trail (`AuditLog`, `audit/` package): append-only who/what/when; a daily `@Scheduled` sweep purges entries older than the retention window (currently **7 days**)

**Media** (`MediaController`, 2 endpoints)
- [x] Uploads stored as **DB blobs** (`MediaAsset` `byte[]`) — deliberately **not** S3

---

## Cross-cutting hardening done

- **Race conditions closed.** Concurrency-sensitive paths (bidding, registration, assignment) use **pessimistic DB locks + unique constraints** rather than optimistic retries, so the database is the arbiter of correctness under contention. Game-vote popularity recompute is serialized with a `ReentrantLock` held **across the commit** (via `TransactionTemplate`) so two simultaneous voters can't clobber each other with stale counts — popularity is a pure function of the committed vote rows, so it always converges.
- **Pretty-URL slug resolution.** `Player` (gamerTag), `Franchise` (tag), `Match` (`slug`, `@PrePersist` `game-date-hex`) and `Announcement` (`shortCode`, base64url) resolve by **slug OR uuid** at every read seam — the UI emits clean URLs while old notification links (stored as `/match/{uuid}`) still resolve.
- **Scale-conscious queries.** Aggregate recompute instead of per-row walks, **bounded background sweeps** (`@EnableScheduling`), JPA entity graphs to avoid N+1, and explicit indexes on hot lookup columns.
- **AWS/prod readiness.** The `postgres` profile has been validated end-to-end; `server.forward-headers-strategy: native` for correct scheme/host/client-IP behind an ALB; fail-fast startup when required secrets are missing; multi-stage `Dockerfile` + `docker-compose.yml`. Prod runs a single **EC2 `t3.small` (2 GB) + RDS**; the full deploy + the memory-safe update flow (add swap, then stop-first + sequential image builds so a build can't OOM-freeze the box) live in the root **`DEPLOYMENT.md`** / `setup-swap.sh` / `update-prod.sh`. The compose caps the running JVM (`mem_limit` + `MaxRAMPercentage=65`).
- **Caching.** Read-heavy browse pages are served from Caffeine with `@CacheEvict` on writes (~45s TTL) — full rationale in [caching-hld.md](./caching-hld.md).
- **Error contract.** One `@RestControllerAdvice` (`common/GlobalExceptionHandler`) maps everything to a `{code, message, details}` envelope.

---

## Runtime profiles & configuration

Two profiles in `src/main/resources/application.yml`; default is `dev`.

| Concern | `dev` | `postgres` |
|---|---|---|
| Database | in-memory H2 (`MODE=PostgreSQL`) | PostgreSQL |
| Schema | `ddl-auto: create-drop` | `ddl-auto: update` (additive only) |
| Seed data | `DataSeeder` demo league (**Season 04**) | none (`SIDEQUEST_SEED_ENABLED` default false) |
| JWT secret | committed dev fallback | **required** (`${SIDEQUEST_JWT_SECRET}`, no fallback → fail-fast) |
| SMTP | unset → OTPs logged to stdout | required outside dev |
| Swagger `/docs` | enabled | disabled |
| Proxy headers | — | `forward-headers-strategy: native` |
| Connection pool | H2 default | Hikari (`maximum-pool-size` 10, 5s timeout, leak detection) |

Token lifetimes: **access 1h** (`SIDEQUEST_ACCESS_TTL` = 3600), **refresh 30d** (`SIDEQUEST_REFRESH_TTL` = 2592000, rotated on every refresh). All tunable env keys are documented in `../.env.example`.

The mail health indicator is disabled (`management.health.mail.enabled: false`) so a mail outage can't flip `/v1/actuator/health` to `DOWN` and fail the load-balancer probe.

---

## API & realtime surface

- **REST:** 129 endpoints across 15 controllers, all under `/v1`. Browsable via Swagger UI at `/v1/docs` on the `dev` profile.
- **WebSocket** (raw handlers under `realtime/`, in-process topic pub/sub via `RealtimeService`):

```
/ws/live/standings        → standings ticks
/ws/live/matches/{id}     → live scores for one match
/ws/live/auctions/{id}    → live bid updates (bidders + admins only)
/ws/live/me               → personal pushes for the authenticated user
```

Auth on WS is via a `?token=<jwt>` query param (browsers can't set Authorization headers on the WS handshake).

---

## Test coverage

- **34 ordered end-to-end integration tests** in a single `SideQuestApiIntegrationTest` (~1,360 LOC), `@SpringBootTest(RANDOM_PORT)` + `@TestMethodOrder(OrderAnnotation.class)`, driving the real HTTP surface against an H2-backed app.
- Coverage is **flow-oriented** (register → verify → login → register for a season → auction → match → standings), not per-unit. There are no isolated unit tests for individual services.
- Newer scenarios cover the batches-11–15 surface: uniqueness + add-game + static seed, per-field privacy matrix, **owner-only profile edit + account-email visibility**, **username rules + availability + onboarding guard**, the **auction standing pool** (spectator-stripped vs admin), **game-popularity voting** (idempotent, popularity math), and the **admin account avatar**.

---

## Known limitations / roadmap

Honest gaps — none are blockers for a demo, all matter before a real production launch.

1. **No Flyway (or Liquibase).** Prod schema evolves via `ddl-auto: update`, which is additive-only — it never drops or alters a column safely. A migration tool is the recommended next step before any non-additive schema change.
2. **No load test yet.** Concurrency correctness is covered by locks + constraints and reasoned through, but throughput/latency under real contention (esp. live bidding) is unmeasured.
3. **`Dockerfile` defaults to the `dev` profile.** The image ships `SPRING_PROFILES_ACTIVE=dev` (in-memory H2 + seeded Season 04) — convenient for the Hugging Face Spaces demo, but a real deploy must override to `postgres` and supply the secrets.
4. **Realtime is auction-first on the client.** All four `/ws/live/*` channels exist and publish server-side, but only the **auction** channel is wired into the frontend today; `standings` and `matches/{id}` are built and untapped.
5. **A few endpoints have no frontend consumer** yet — the backend is ahead of the client in places.
6. **Single integration-test class.** Broad end-to-end coverage exists, but there's no service-level unit layer to localize failures.

---

## Bottom line

Feature-complete across the full league lifecycle, hardened for correctness (locks + constraints) and scale (aggregate recompute, bounded sweeps, indexes, caching), and validated end-to-end on PostgreSQL. The remaining work is operational, not functional: a migration tool, a load test, a `postgres`-profile deploy, and finishing the realtime + endpoint wiring on the client. **Production-ready pending a staging deploy pass.**
