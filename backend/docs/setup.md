# Setup & running

How to build, configure, and run the Side Quest backend locally and in a container — dev (H2) and production-shaped (PostgreSQL).

**See also:** [./caching-hld.md](./caching-hld.md) (server-side cache design) · [../README.md](../README.md) (API overview) · [../CLAUDE.md](../CLAUDE.md) (backend conventions) · [../../CLAUDE.md](../../CLAUDE.md) (workspace conventions)

---

## At a glance

| | |
|---|---|
| Language / runtime | Java 21 |
| Framework | Spring Boot 3.3.4 (`spring-boot-starter-parent`) |
| Build | Maven via the bundled wrapper (`./mvnw`), no system Maven needed |
| Artifact | `com.sidequest:sidequest-backend:1.0.0` → `target/sidequest-backend.jar` |
| Base path | `/v1` (`server.servlet.context-path`) |
| Size | 238 `.java` files · ~16.8K LOC · 33 Spring Data repositories · 38 `@Entity` · 17 enums |
| Surface | 118 REST endpoints across 15 `*Controller` classes |
| Tests | 1 integration suite (`SideQuestApiIntegrationTest`), 26 `@Order`-ed end-to-end tests |

Key URLs once running (note the `/v1` context path on **everything**, including actuator):

| What | URL (dev) |
|---|---|
| Swagger UI | `http://localhost:8080/v1/docs` |
| OpenAPI JSON | `http://localhost:8080/v1/api-docs` |
| Health | `http://localhost:8080/v1/actuator/health` |
| H2 console (dev only) | `http://localhost:8080/v1/h2-console` |

> In the `postgres` profile, Swagger UI and `/api-docs` are **disabled** (`springdoc.*.enabled: false`) so the full admin surface isn't publicly browsable in production.

---

## Prerequisites

- **JDK 21** — a full JDK, not a JRE. The Maven wrapper compiles source and runs annotation processors (Lombok), so a JRE-only environment fails the build with a "no compiler" / `javac` error even though `java -jar` on a prebuilt jar would work. Verify with `javac -version` (not just `java -version`).
- **Docker** (optional) — only for the container / compose paths below.
- **PostgreSQL 16** (optional) — only if you run the `postgres` profile without Docker.

Everything else (Maven, all dependencies) is fetched by the wrapper on first run. No global install required.

---

## Run locally — dev profile (H2 + seeded demo league)

The default profile is `dev`: an in-memory **H2** database (`ddl-auto: create-drop`) that a `DataSeeder` fills with a realistic demo league (**Season 04**) at startup. No external services are needed — no DB, no SMTP, no Google client.

```bash
cd "SideQuests arena backend"
./mvnw spring-boot:run
# → http://localhost:8080/v1/docs
```

Data is wiped on every restart (in-memory + `create-drop`). Seeding is idempotent within a run and gated by `sidequest.seed.enabled` (on for `dev`, off for `postgres`) **and** `@Profile("dev")`, so the known-password demo accounts can never load outside dev.

### Build and run the jar

```bash
./mvnw -DskipTests package
java -jar target/sidequest-backend.jar        # defaults to the dev profile
```

`finalName` is pinned to `sidequest-backend`, so the jar path is stable at `target/sidequest-backend.jar` (the Dockerfile relies on this).

Run the test suite (spins up the full context + the 26-step integration flow):

```bash
./mvnw test
```

---

## Docker (single backend image)

Multi-stage build: `maven:3.9-eclipse-temurin-21` compiles the jar, `eclipse-temurin:21-jre` runs it. The runtime image runs as **uid 1000** (Hugging Face Spaces convention), installs `curl` for the container `HEALTHCHECK`, and bakes `SPRING_PROFILES_ACTIVE=dev` so the image runs standalone with no external services.

```bash
cd "SideQuests arena backend"
docker build -t sidequest-backend .
docker run --rm -p 8080:8080 sidequest-backend
# → http://localhost:8080/v1/docs
```

The `HEALTHCHECK` polls `http://localhost:8080/v1/actuator/health` every 30s (40s start period). JVM heap is capped at `-XX:MaxRAMPercentage=75.0` via `JAVA_OPTS`.

To run the image against Postgres instead, override the profile and datasource env:

```bash
docker run --rm -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=postgres \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/sidequest \
  -e SPRING_DATASOURCE_USERNAME=sidequest \
  -e SPRING_DATASOURCE_PASSWORD=sidequest \
  -e SIDEQUEST_JWT_SECRET="$(openssl rand -base64 48)" \
  -e SMTP_HOST=... -e SMTP_USERNAME=... -e SMTP_PASSWORD=... \
  sidequest-backend
```

---

## Docker Compose (full stack: db + backend + frontend)

`docker-compose.yml` lives at the **workspace root** (one level above this repo), not in the backend directory. It mirrors an AWS deploy on one host: PostgreSQL + the backend (postgres profile) + the Next.js frontend.

```bash
cd "/home/SammyUrfen/Codes/SideQuests arena"   # workspace root
docker compose up --build
# frontend → http://localhost:3000   (talks to the backend at http://localhost:8080/v1)
```

| Service | Image / context | Host port | Notes |
|---|---|---|---|
| `db` | `postgres:16-alpine` | **5433** → 5432 | 5433 avoids clashing with a host-local Postgres; volume `sidequest-db` persists data |
| `backend` | `./SideQuests arena backend` | 8080 | `postgres` profile; waits for `db` healthcheck |
| `frontend` | `./SideQuests arena frontend` | 3000 | `NEXT_PUBLIC_API_URL=http://localhost:8080/v1` **baked at build time** |
| `mailhog` | `mailhog/mailhog` | 8025 (UI) | optional; only starts with `--profile mail` |

The compose file ships throwaway defaults (`SIDEQUEST_JWT_SECRET`, `DB_PASSWORD`) for local use — override them for anything beyond your laptop. To catch OTP emails locally instead of letting SMTP fail, add the mail catcher:

```bash
docker compose --profile mail up --build   # OTP emails viewable at http://localhost:8025
```

> Because the frontend's API URL is compiled into the client bundle, changing `NEXT_PUBLIC_API_URL` requires a **frontend rebuild**, not just a restart.

---

## Profiles: `dev` vs `postgres`

Selected by `SPRING_PROFILES_ACTIVE`. Both share the common config block (`/v1` context path, JWT, CORS, mail, caching); the profile blocks in `application.yml` differ as follows:

| | `dev` (default) | `postgres` |
|---|---|---|
| Database | in-memory H2 (`MODE=PostgreSQL`) | PostgreSQL |
| Schema | `ddl-auto: create-drop` (recreated each boot) | `ddl-auto: update` (additive: adds tables/columns/indexes, never drops) |
| Seed data | Season 04 demo league seeded | none (unless `SIDEQUEST_SEED_ENABLED=true` — never do this against a real DB) |
| H2 console | enabled at `/v1/h2-console` | n/a |
| Swagger / OpenAPI | enabled (`/v1/docs`) | **disabled** |
| Connection pool | H2 default | Hikari: `maximum-pool-size=${DB_POOL_SIZE:10}`, 5s connect timeout, 30s leak detection |
| Proxy awareness | — | `server.forward-headers-strategy: native` (honours `X-Forwarded-*` behind an ALB) |
| JWT secret | committed dev-only default | **required** — no fallback, app fails fast at startup if unset |

**Fail-fast guarantees** (deliberate — see `application.yml` comments):
- `postgres` with no `SIDEQUEST_JWT_SECRET` → startup fails rather than silently signing tokens with the public dev secret.
- Any non-`dev` profile with no `SMTP_HOST` → startup fails, so OTPs can never silently dump to stdout in production. (`dev` with no SMTP is fine — `EmailService` logs the OTP to the console.)

`ddl-auto: update` is a pragmatic bootstrap; a dedicated migration tool (Flyway) is the recommended next step once the schema needs anything non-additive.

---

## Environment variables

Copy `.env.example` → `.env` (or set these in your orchestrator). Spring reads them via `${VAR:default}` placeholders in `application.yml`; values below are the built-in defaults.

| Variable | Default | Notes |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | `dev` | `dev` or `postgres` |
| `SIDEQUEST_JWT_SECRET` | dev-only committed value | **Required in `postgres`** (no fallback). Use ≥ 32 random chars |
| `SIDEQUEST_ACCESS_TTL` | `3600` | access-token TTL, seconds (1 h) |
| `SIDEQUEST_REFRESH_TTL` | `2592000` | refresh-token TTL, seconds (30 d, rotated on refresh) |
| `SIDEQUEST_CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173` | comma-separated; a wildcard disables credentialed CORS |
| `SMTP_HOST` | *(empty)* | empty → OTPs log to console (**dev only**); required outside dev |
| `SMTP_PORT` | `587` | |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | *(empty)* | e.g. a Gmail app password |
| `SIDEQUEST_MAIL_FROM` | `no-reply@sidequest.gg` | From address on OTP mail |
| `SIDEQUEST_GOOGLE_CLIENT_ID` | *(empty)* | Web OAuth client id; empty → `/auth/google` returns a clean "not configured" error and the frontend hides the button. Must match the frontend `NEXT_PUBLIC_GOOGLE_CLIENT_ID` |
| `SPRING_DATASOURCE_URL` | `jdbc:postgresql://localhost:5432/sidequest` | `postgres` profile only |
| `SPRING_DATASOURCE_USERNAME` | `sidequest` | |
| `SPRING_DATASOURCE_PASSWORD` | `sidequest` | |
| `DB_POOL_SIZE` | `10` | keep `instances × DB_POOL_SIZE` well under the DB's `max_connections` |
| `SIDEQUEST_SEED_ENABLED` | `false` | seed demo data on `postgres`; never enable against a real DB |

The SMTP health probe is disabled (`management.health.mail.enabled: false`) so a mail outage can't flip `/v1/actuator/health` to DOWN and fail a load-balancer check.

---

## PostgreSQL locally (without Docker)

Create the role and database the `postgres` profile expects:

```sql
CREATE ROLE sidequest WITH LOGIN PASSWORD 'sidequest';
CREATE DATABASE sidequest OWNER sidequest;
```

Then run:

```bash
SPRING_PROFILES_ACTIVE=postgres \
SIDEQUEST_JWT_SECRET="$(openssl rand -base64 48)" \
SMTP_HOST=localhost SMTP_PORT=1025 \
./mvnw spring-boot:run
```

> **SSL note:** against managed Postgres (e.g. RDS), append `?sslmode=require` to `SPRING_DATASOURCE_URL` so the JDBC connection is TLS — unless the DB parameter group already forces it (`rds.force_ssl`).

`ddl-auto: update` creates the schema on first boot; there is no seed, so the DB starts empty (register a user via `/v1/auth/register`, or set `SIDEQUEST_SEED_ENABLED=true` for a throwaway demo DB only).

---

## Demo credentials (dev profile only)

Seeded by `DataSeeder` for Season 04. **The password for every account is `password`.**

| Email | Role | Notes |
|---|---|---|
| `admin@sidequest.gg` | `ADMIN` | League admin / control room |
| `manager@sidequest.gg` | `FRANCHISE_MANAGER` | Standalone manager account |
| `raghavan@sidequest.gg` | `PLAYER` / franchise owner | Owner of a seeded franchise (`FRANCHISE_OWNER`) |
| `vortex@`, `blaze@`, `nova@`, `ace@`, `kiran@`, … `@sidequest.gg` | `PLAYER` | Rostered players (VERIFIED) |
| `ghost@`, `pulse@`, `volt@`, `rex@`, `hex@` `@sidequest.gg` | `PLAYER` | Free agents in the Season 04 auction pool |
| `rookie@`, `drift@` `@sidequest.gg` | `PLAYER` | `PENDING` (not yet verified) |

Auth is JWT (jjwt 0.12.6) Bearer tokens over BCrypt-hashed passwords, with method-level `@PreAuthorize` on roles `PLAYER` / `FRANCHISE_MANAGER` / `FRANCHISE_OWNER` / `ADMIN`.

### Quick login (curl)

`POST /v1/auth/login` takes an `identifier` (email or gamer tag) + `password` and returns an access/refresh token pair.

```bash
curl -sS -X POST http://localhost:8080/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"admin@sidequest.gg","password":"password"}'
```

```jsonc
{ "accessToken": "eyJ…", "refreshToken": "…", "tokenType": "Bearer", "expiresIn": 3600, "user": { … } }
```

Use the token on subsequent calls:

```bash
curl -sS http://localhost:8080/v1/auth/me -H "Authorization: Bearer <accessToken>"
```

---

## Deploy notes

### Hugging Face Spaces (Docker SDK)

The backend `README.md` front-matter declares `sdk: docker` and `app_port: 8080`, so Spaces builds the `Dockerfile` directly. The image already runs as uid 1000 (which Spaces requires) and defaults to the `dev` profile — override `SPRING_PROFILES_ACTIVE` and the secrets in the Space's variables/secrets to point at a real database and SMTP.

### AWS (RDS + ALB)

- **Database:** RDS PostgreSQL. Set `SPRING_DATASOURCE_*`, add `?sslmode=require` (or rely on `rds.force_ssl`), and size `DB_POOL_SIZE` so `tasks × pool` stays under the instance's `max_connections`.
- **Load balancer:** the `postgres` profile sets `server.forward-headers-strategy: native`, so Tomcat trusts `X-Forwarded-*` from the ALB and resolves the original scheme/host/client IP — needed for correct redirect URLs, CORS, and rate-limit keys.
- **Secrets:** `SIDEQUEST_JWT_SECRET` and `SMTP_*` are mandatory (the app fails fast without them). Store them in Secrets Manager / task-definition secrets, not the image.
- **Frontend:** its API URL (`NEXT_PUBLIC_API_URL`) is baked at **build time**, so the frontend image must be rebuilt whenever the backend's public URL changes — it's not a runtime env var.

---

## Limitations / gotchas

- **JRE-only environments can't build** — a common failure on minimal containers/CI. Install a full JDK 21.
- **Media is stored as DB blobs** (`MediaAsset.byte[]`), not S3 — large uploads bloat the database and every fetch round-trips through the app. Fine at demo scale; revisit before heavy media use.
- **Caching is in-process (Caffeine, 45s TTL)** — correct for a single instance only. Running multiple instances needs a shared cache (Redis) so evictions propagate; see [./caching-hld.md](./caching-hld.md).
- **Realtime is a raw in-process WebSocket hub** (`/v1/ws/live/{standings,matches/{id},auctions/{id},me}`) with in-memory topic pub/sub — it does not fan out across instances. Single-instance only until externalised.
- **`ddl-auto: update` is not a migration tool** — it won't perform destructive or renaming changes. Adopt Flyway before the schema needs anything non-additive.
- **Dev data is ephemeral** — H2 in-memory + `create-drop` wipes everything on restart.
