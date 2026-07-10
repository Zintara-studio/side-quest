# Tech stack

The Side Quest backend is a modular Spring Boot REST API for an esports-league platform (players, franchises, auctions, matches, standings, disputes). This document is the grounded, per-layer reference for what the backend is built from and *why* each choice was made — read it before adding a dependency or swapping a layer.

**See also:** [./caching-hld.md](./caching-hld.md) (caching design in detail) · [../README.md](../README.md) (run/build) · [../CLAUDE.md](../CLAUDE.md) (working conventions).

> Repo root: `SideQuests arena backend/`. Source under `src/main/java/com/sidequest/arena`, config in `src/main/resources/application.yml`, `Dockerfile` at the root. Every version below is read from `pom.xml`; every count is measured against the tree (see [At a glance](#at-a-glance)).

---

## At a glance

| Metric | Value |
|---|---|
| Main `.java` files | 238 |
| Main source LOC | ~16,820 |
| Feature packages | 22 under `com.sidequest.arena` |
| `@Entity` classes | ~35 (all in `model/`) |
| Enums | 17 (all in `model/`) |
| Spring Data repositories | 33 (`repo/`) |
| `*Controller` classes | 15 |
| REST endpoints (`@*Mapping`) | 118 |
| Integration test files | 1 (`SideQuestApiIntegrationTest`, ~1,100 LOC, 26 `@Order`-ed E2E tests) |

Package-by-feature, not package-by-layer: each feature owns its `Controller` + `Service` + `dto/`. File counts per package: `admin`(10), `announcements`(5), `auctions`(15), `audit`(1), `auth`(16), `common`(7), `config`(3), `disputes`(3), `email`(2), `franchises`(15), `games`(6), `matches`(21), `media`(5), `model`(51), `notifications`(3), `players`(9), `realtime`(3), `registrations`(8), `repo`(33), `scoring`(1), `seasons`(5), `security`(9), `standings`(6).

---

## The stack, layer by layer

Versions come from `pom.xml`. Where a version cell reads *(managed)*, the artifact is version-managed by `spring-boot-starter-parent` 3.3.4 and inherits a Spring-Boot-curated version rather than pinning its own.

| Layer | Choice | Version | Why this |
|---|---|---|---|
| Language / runtime | Java | 21 | LTS; records (used for DTOs/`ApiError`), pattern-matching `switch`, virtual-thread-ready. `maven.compiler.source/target = 21`. |
| Build | Maven + wrapper | `spring-boot-maven-plugin` (managed) | `./mvnw` / `mvnw.cmd` committed so the exact Maven version is reproducible without a local install. `finalName: sidequest-backend`. |
| Framework | Spring Boot (`spring-boot-starter-parent`) | 3.3.4 | Batteries-included DI, auto-config, and BOM version management across every dependency below. |
| Web / HTTP | `spring-boot-starter-web` (Web MVC + embedded Tomcat) | (managed) | Synchronous, blocking MVC — the workload is DB-bound CRUD + auctions, not high-fan-out streaming, so MVC keeps the mental model simple. Response compression enabled for JSON >1 KB. |
| Persistence | `spring-boot-starter-data-jpa` (Hibernate) | (managed) | 33 repositories over ~35 entities; derived queries + a few `@Query`s. `open-in-view: false` (no lazy-load-in-view surprises — services close their own transactions). |
| DB — dev | H2 (in-memory) | (managed, `runtime`) | `jdbc:h2:mem` in `MODE=PostgreSQL`, `ddl-auto: create-drop`, seeded by `DataSeeder`. Zero external services for local dev / the demo container. |
| DB — prod | PostgreSQL | (managed, `runtime`) | `postgres` profile; `ddl-auto: update` (additive only). HikariCP pool tuned (`maximum-pool-size` default 10, `connection-timeout` 5 s, `leak-detection-threshold` 30 s). |
| Security — framework | `spring-boot-starter-security` | (managed) | Filter chain, `@EnableMethodSecurity` + `@PreAuthorize` guards (used across 11 classes), password hashing. |
| Security — password hash | `BCryptPasswordEncoder` | (from Spring Security) | Adaptive salted hashing; the default work factor. `SecurityConfig` wires it as the `PasswordEncoder` bean. |
| Security — tokens | jjwt (`jjwt-api` + `jjwt-impl` + `jjwt-jackson`) | 0.12.6 | Stateless Bearer JWTs. `impl`/`jackson` are `runtime`-scoped so app code only compiles against the API. Access TTL 1 h, refresh TTL 30 d (rotated per refresh; `RefreshToken` persisted). |
| Security — Google Sign-In | `google-api-client` | 2.7.0 | Verifies the Google `id_token` server-side (signature / audience / issuer / exp) in `/auth/google`. Unset client id in dev → clean "not configured" error, frontend hides the button. |
| Realtime | `spring-boot-starter-websocket` | (managed) | Raw `WebSocketHandler` (not STOMP) at `/ws/live/**`; in-process topic pub/sub via `RealtimeService`. See [Realtime](#realtime). |
| Caching | `spring-boot-starter-cache` + Caffeine | (managed) | In-process, TTL'd read cache for hot public read paths. `@EnableCaching`, single `CaffeineCacheManager`, `expireAfterWrite` 45 s, `@CacheEvict` on writes. Details in [./caching-hld.md](./caching-hld.md). |
| Mail | `spring-boot-starter-mail` | (managed) | Gmail-SMTP OTP delivery, fully env-driven. `JavaMailSender` auto-configures only when `SMTP_HOST` is set; unset in dev → `EmailService` logs the OTP to stdout. |
| Validation | `spring-boot-starter-validation` (Jakarta Bean Validation / Hibernate Validator) | (managed) | `@Valid` request DTOs; violations map to the `{code,message,details}` envelope via the global handler. |
| API docs | springdoc-openapi (`springdoc-openapi-starter-webmvc-ui`) | 2.6.0 | Swagger UI at `/docs`, OpenAPI JSON at `/api-docs` (both under the `/v1` context path). **Disabled entirely in the `postgres` profile** so the admin surface isn't publicly browsable in prod. |
| Ops / health | `spring-boot-starter-actuator` | (managed) | `/actuator/health` drives the container `HEALTHCHECK`. Mail health indicator disabled so a mail outage can't flip liveness to DOWN. |
| Boilerplate | Lombok | (managed, `optional`, excluded from the jar) | Getters/builders/loggers on entities & DTOs. Annotation-processor path declared; excluded from the fat jar and the Boot repackage. |
| Testing | `spring-boot-starter-test`, `spring-security-test`, Apache `httpclient5` | (managed) | One full-stack integration test boots the app and runs 26 `@Order`-ed calls end-to-end. `httpclient5` is a test-only swap because the JDK client throws `HttpRetryException` on 401 POSTs. |

---

## Runtime shape

- **Context path** `/v1` (`server.servlet.context-path`) — every route and the actuator/Swagger paths live under it.
- **Two Spring profiles** selected by `spring.profiles.active` (default `dev`):

  | | `dev` | `postgres` |
  |---|---|---|
  | Database | H2 in-memory (`MODE=PostgreSQL`) | PostgreSQL + HikariCP |
  | Schema | `ddl-auto: create-drop` | `ddl-auto: update` (additive) |
  | Seed data | `DataSeeder` → demo league "Season 04" (`S04`, a finished `S03` with frozen history + active `S04`) | none (`SIDEQUEST_SEED_ENABLED` default false) |
  | JWT secret | committed dev-only fallback | **required** — no fallback, app fails fast at startup if unset |
  | Swagger / api-docs | on | off |
  | Proxy headers | — | `forward-headers-strategy: native` (honour `X-Forwarded-*` behind an ALB) |

- **Fail-fast posture:** the JWT secret is mandatory in `postgres` (no silent fallback to the dev key), and SMTP is expected outside dev (otherwise OTPs would only reach stdout). Correctness/reliability over convenience.

## Errors

One envelope everywhere: the `ApiError` record — `{ code, message, details, path, timestamp }` — produced by `GlobalExceptionHandler` (`common/`) from an `ApiException(ErrorCode, message, details)` hierarchy (13 `ErrorCode` values). Validation failures, auth denials, and thrown `ApiException`s all funnel through it, so clients see one shape. `common/` also holds cross-cutting helpers: `PageResponse`, `Cursors`, `Hashing`.

## Realtime

Raw WebSocket, no STOMP/SockJS broker. `WebSocketConfig` registers a single `LiveWebSocketHandler` under `/ws/live/**`; clients authenticate with `?token=<jwt>`:

| Endpoint | Pushes |
|---|---|
| `/ws/live/standings` | standings table changes |
| `/ws/live/matches/{id}` | live match/round updates |
| `/ws/live/auctions/{id}` | live auction lot/bid updates |
| `/ws/live/me` | per-user notifications |

`RealtimeService` is an in-process topic pub/sub: services publish to a topic, the handler fans out to that topic's subscribed sessions. Simple and dependency-free — see [Deliberately not used](#deliberately-not-used) for the scaling caveat.

## Media

Uploaded images (avatars, logos) are stored as **DB blobs**: `MediaAsset.data` is a plain `byte[]` with an explicit column length, deliberately **not** `@Lob` (to avoid Postgres large-object/`oid` handling). Served by `MediaController`. No object store.

## Container & compose

- **`Dockerfile`** — multi-stage: `maven:3.9-eclipse-temurin-21` builds the jar (deps cached via `dependency:go-offline`), runtime is `eclipse-temurin:21-jre`. Runs as **uid 1000** (Hugging Face Spaces convention), `curl` added only for the `HEALTHCHECK` (`GET /v1/actuator/health`, 30 s interval). Defaults to the `dev` profile so the image is self-contained.
- **`docker-compose.yml`** (at the workspace root, one level above this repo) — `db` (`postgres:16-alpine`) + `backend` + `frontend` + optional `mailhog` for local OTP inspection.

---

## Deliberately not used

Honest omissions — each is a conscious trade-off, not an oversight:

| Not used | Instead | Trade-off / when to revisit |
|---|---|---|
| **Redis** (or any external broker) | `RealtimeService` in-process pub/sub + Caffeine cache | Zero infra, fine for a single instance. **Breaks on horizontal scale** — a WebSocket client only sees events published on *its* node, and each node has its own 45 s cache. Multi-instance ⇒ needs Redis pub/sub or a shared broker. |
| **S3 / object storage** | `MediaAsset` `byte[]` blobs in the DB | One store, transactional, trivial backups. Bloats the DB and pushes bytes through the app on every read; move to object storage if media volume grows. |
| **Flyway / Liquibase** | Hibernate `ddl-auto` (`create-drop` dev, `update` prod) | No migration tooling yet. `update` is additive only — it never drops or alters a column's type. A versioned migration tool is the documented next step before any non-additive schema change. |
| **STOMP / SockJS** | Raw `WebSocketHandler` | Full control of the wire protocol, no broker relay. Loses STOMP's built-in subscription/ack semantics — re-implemented minimally in `RealtimeService`. |
| **Reactive stack (WebFlux/R2DBC)** | Blocking Web MVC + JPA | Team-familiar, simpler debugging; the workload is DB-bound CRUD, not massive concurrent streaming. |

---

## Onboarding pointers

- Entry points: `AuthController`, `PlayerController`, `FranchiseController`, `GameController`, `MatchController`, `RegistrationController`, `StandingsController`, `AnnouncementController`, `AuctionController`, `SeasonController`, `DisputeController`, `NotificationController`, `MediaController`, `AdminController`, `SettingsController`.
- Run dev: `./mvnw spring-boot:run` → H2 + seeded Season 04, Swagger at `http://localhost:8080/v1/docs`.
- Roles are `PLAYER`, `FRANCHISE_MANAGER`, `ADMIN` (`model/Role`), enforced with `@PreAuthorize`.
- Keep it grounded: this file is a **living reference** — when you bump a version in `pom.xml`, change a profile in `application.yml`, or add a feature package, update the tables above in the same change.
