# Troubleshooting

Common failure modes when building, running, and deploying the Side Quest backend, each as **problem → cause → fix**, grounded in the actual code and config.

See also: [./setup.md](./setup.md) (run/profiles/env), [./architecture.md](./architecture.md) (request flow, auth, realtime), [./caching-hld.md](./caching-hld.md) (Caffeine caching), and [../CLAUDE.md](../CLAUDE.md) (operating rules).

Fixed facts this doc assumes: **Java 21**, **Spring Boot 3.3.4** (`spring-boot-starter-parent`), Maven via the bundled `./mvnw` wrapper, the app runs on **:8080** under context path **`/v1`** (`server.servlet.context-path`), and the default profile is **`dev`** (in-memory H2). Config lives in [`src/main/resources/application.yml`](../src/main/resources/application.yml); the multi-stage `Dockerfile` is at the repo root; `docker-compose.yml` is at the **workspace** root (one level above this repo).

## Quick index

| # | Symptom | Jump to |
|---|---------|---------|
| 1 | Build fails, complains about `tools.jar` / no compiler | [Build fails — JRE, not JDK](#1-build-fails--jre-not-jdk) |
| 2 | `Port 8080 was already in use` | [Port 8080 already in use](#2-port-8080-already-in-use) |
| 3 | `postgres` profile: *Ident authentication failed* | [Postgres ident auth failure](#3-postgres-wont-start--ident-authentication-failed) |
| 4 | Boot crashes with `IllegalStateException` about JWT/SMTP | [Fail-fast on JWT_SECRET / SMTP](#4-boot-fails-fast-jwt_secret-or-smtp-missing) |
| 5 | Prod logs `RUNNING THE DEV PROFILE` | [Accidentally on the dev profile](#5-running-the-dev-profile-warning-in-a-real-deploy) |
| 6 | OTP email never arrives (local dev) | [OTP not delivered in dev](#6-otp-email-never-arrives-in-dev) |
| 7 | Every authenticated call returns `401` | [401 on every call](#7-401-on-every-authenticated-call) |
| 8 | `/h2-console` returns `404` in prod | [H2 console 404 in prod](#8-h2-console-404-in-production) |
| 9 | New entity column/constraint missing on Postgres | [Schema drift on ddl-auto: update](#9-a-new-column-or-constraint-is-missing-after-an-entity-change-postgres) |

---

## 1. Build fails — JRE, not JDK

**Problem.** `./mvnw -q compile` (or `package`) fails early — no annotation processing, a missing-compiler error, or a stack trace referencing `tools.jar` / `javac`. The Maven wrapper downloads fine but nothing compiles.

**Cause.** A **JRE** is on `PATH`, not a full **JDK**. Compiling Java 21 source (and the Lombok / Spring Boot repackage plugin) needs `javac` and the compiler tooling that a JRE-only install does not ship. This bites JRE-only container/base images and minimal server installs.

**Fix.** Install a full **JDK 21** and point `JAVA_HOME` at it.

```bash
java -version    # must report 21.x
javac -version   # must ALSO exist and report 21.x  ← the tell: JRE has java but not javac
```

On Fedora: `sudo dnf install java-21-openjdk-devel` (the `-devel` package is the JDK; the plain package is JRE-only). Then rebuild:

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk
./mvnw -q clean package   # produces target/sidequest-backend.jar
```

If you would rather not touch the host toolchain at all, build inside the multi-stage `Dockerfile` — its `build` stage uses `maven:3.9-eclipse-temurin-21`, which is a full JDK.

---

## 2. Port 8080 already in use

**Problem.** Startup dies with `Web server failed to start. Port 8080 was already in use.`

**Cause.** A previous backend instance (or another service) still holds `:8080`. The app has no auto-port-fallback — `server.port: 8080` is fixed.

**Fix.** Find and kill the stale process by PID (do **not** blanket-`pkill java` — that can take out unrelated JVMs, including your IDE and any test instance):

```bash
lsof -iTCP:8080 -sTCP:LISTEN     # or: ss -ltnp 'sport = :8080'
kill <pid>                        # kill -9 <pid> only if it won't exit
```

To run a throwaway second instance on a different port instead of killing the first:

```bash
SERVER_PORT=8090 ./mvnw spring-boot:run     # or -Dserver.port=8090
```

Remember the context path: the app is reachable at `http://localhost:8080/v1`, and health at `http://localhost:8080/v1/actuator/health` — not the bare root.

---

## 3. Postgres won't start — *Ident authentication failed*

**Problem.** On `SPRING_PROFILES_ACTIVE=postgres`, HikariCP fails to connect: `FATAL: Ident authentication failed for user "sidequest"` (or `password authentication failed` / `no pg_hba.conf entry`).

**Cause.** A **host-local** PostgreSQL. Default `pg_hba.conf` on many distros uses `ident`/`peer` auth for local TCP connections, which maps the OS user — not a password. The app connects over TCP with a username+password (`SPRING_DATASOURCE_USERNAME` / `_PASSWORD`), which `ident` rejects.

**Fix — pick one:**

1. **Use the Docker Postgres container instead** (simplest, matches prod). `docker-compose.yml` at the workspace root ships a `postgres:16-alpine` service with password auth already configured. It publishes host **5433 → container 5432** (deliberately off 5432 so it won't clash with a host-local Postgres):

   ```bash
   cd "<workspace root>"        # the dir containing docker-compose.yml, one level up from this repo
   docker compose up --build     # brings up db + backend (postgres profile) + frontend
   ```

   If you point the app at that container from the host, use `jdbc:postgresql://localhost:5433/sidequest`. Inside compose the backend uses `db:5432` (see `SPRING_DATASOURCE_URL` in the compose file).

2. **Fix host `pg_hba.conf`** to use password auth for TCP. Change the relevant lines from `ident` to `scram-sha-256` (preferred) or `md5`, then reload:

   ```
   # /var/lib/pgsql/data/pg_hba.conf   (path varies by distro)
   host    sidequest   sidequest   127.0.0.1/32   scram-sha-256
   host    sidequest   sidequest   ::1/128        scram-sha-256
   ```

   ```bash
   sudo -u postgres psql -c "ALTER ROLE sidequest WITH PASSWORD 'sidequest';"
   sudo systemctl reload postgresql
   ```

The defaults the app expects (`jdbc:postgresql://localhost:5432/sidequest`, user/pass `sidequest`/`sidequest`) are in `application.yml`; override with `SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD`.

---

## 4. Boot fails fast: `JWT_SECRET` or `SMTP` missing

**Problem.** On a non-`dev` profile the app refuses to start, throwing an `IllegalStateException` during context init:

- `SIDEQUEST_JWT_SECRET must be set to a strong, non-default secret when not running the dev profile`
- `SMTP_HOST (spring.mail.host) must be set when not running the dev profile — the console fallback would log OTPs/reset codes to stdout instead of delivering them.`

**Cause.** This is **intentional fail-fast**, not a bug. Two guards enforce that a real deploy can never run insecurely:

| Guard | Where | Rule |
|-------|-------|------|
| JWT secret | `security/JwtService` constructor | Outside `dev`, the secret must be present, non-blank, **and not** the committed dev default. |
| SMTP host | `email/EmailService` constructor | Outside `dev`, `spring.mail.host` must be set — otherwise OTPs/reset codes would silently print to stdout via the console fallback. |

The committed dev default (`change-me-in-prod-…`) is explicitly rejected outside `dev`, so you can't accidentally ship it.

**Fix.** Set both before starting the `postgres` profile:

```bash
export SIDEQUEST_JWT_SECRET="$(openssl rand -base64 48)"   # long, random, ≥ 32 chars
export SMTP_HOST=smtp.example.com SMTP_PORT=587 \
       SMTP_USERNAME=... SMTP_PASSWORD=...                 # a real relay (or mailhog:1025 locally)
```

For a local compose run, `docker-compose.yml` already wires a default `SIDEQUEST_JWT_SECRET` and points `SMTP_HOST` at the optional `mailhog` service. See [`.env.example`](../.env.example) for every variable and its default. (There is no analogous fail-fast for Google Sign-In: an empty `SIDEQUEST_GOOGLE_CLIENT_ID` just makes `/auth/google` return a clean "not configured" error.)

---

## 5. `RUNNING THE DEV PROFILE` warning in a real deploy

**Problem.** A deployed instance logs, loudly, in its first lines:

```
RUNNING THE DEV PROFILE: in-memory H2 (data lost on restart) + seeded demo
accounts with committed passwords. NOT for production — set
SPRING_PROFILES_ACTIVE=postgres for a real deployment.
```

**Cause.** No active profile was set, so Spring fell back to the default `dev` profile (`spring.profiles.active: dev` in `application.yml`). On `dev` the app runs **in-memory H2 with `ddl-auto: create-drop`** (all data is wiped on every restart) and seeds a demo league (Season 04) with **committed demo passwords** via `DataSeeder`. The `SideQuestApplication.devProfileWarning` bean emits this banner precisely so a misconfigured prod box announces itself instead of silently serving demo credentials.

**Fix.** Set the profile explicitly for any real deployment:

```bash
export SPRING_PROFILES_ACTIVE=postgres
```

The `Dockerfile` bakes in `SPRING_PROFILES_ACTIVE=dev` (so the image runs out-of-the-box for demos with zero external services); `docker-compose.yml` overrides it to `postgres` for the backend service. If you `docker run` the image directly for anything real, pass `-e SPRING_PROFILES_ACTIVE=postgres` yourself.

---

## 6. OTP email never arrives in dev

**Problem.** You register / request a password reset locally, the API succeeds, but no email shows up.

**Cause.** Expected on `dev`. Spring only auto-configures a `JavaMailSender` when `spring.mail.host` (`SMTP_HOST`) is set — it is empty by default — so `EmailService` takes its **console fallback** and logs the message instead of sending it. This is deliberate so local dev needs no SMTP server. (Outside `dev`, this same missing-SMTP condition fails fast instead — see [#4](#4-boot-fails-fast-jwt_secret-or-smtp-missing).)

**Fix.** Read the OTP straight from the backend console log. Grep for the fallback marker:

```
[email:console-fallback] to=you@example.com | subject=...
<body with the code>
```

To exercise **real** delivery locally, bring up the optional mail catcher and point SMTP at it — no fail-fast, and you get a web inbox:

```bash
docker compose --profile mail up          # starts mailhog; UI at http://localhost:8025
# then run the backend with SMTP_HOST=mailhog SMTP_PORT=1025 (compose does this already)
```

Note: delivery failures are swallowed-and-logged on purpose (so mail deliverability can't be probed for account enumeration) — a broken real SMTP config will *not* surface as an API error, only as a `Failed to send email …` warning in the log.

---

## 7. 401 on every authenticated call

**Problem.** Public catalog reads work, but every authenticated request returns `401 Unauthorized` with the standard envelope:

```json
{ "code": "UNAUTHENTICATED", "message": "...", "details": { ... } }
```

**Cause.** No valid `Authorization: Bearer <token>`, or the **access token expired**. The API is stateless JWT: access tokens live **1 hour** (`SIDEQUEST_ACCESS_TTL=3600`), refresh tokens **30 days** (`SIDEQUEST_REFRESH_TTL=2592000`, rotated on every refresh). Any request hitting the `.anyRequest().authenticated()` rule without a live token is rejected by `RestAuthEntryPoint` with this envelope.

**Fix.**

- Confirm the header is actually present and spelled `Authorization: Bearer <access-token>` (not the refresh token).
- If it's merely expired, mint a new access token with the refresh token — no re-login needed:

  ```bash
  curl -sX POST http://localhost:8080/v1/auth/refresh \
       -H 'Content-Type: application/json' \
       -d '{"refreshToken":"<your-refresh-token>"}'
  ```

- If the refresh token is also expired/revoked (or you never had one), log in again via `POST /v1/auth/login`.

A `403` (with `code` like `FORBIDDEN`) is a *different* problem — you're authenticated but lack the role. Admin routes require `ADMIN`, franchise mutations require `FRANCHISE_MANAGER`, enforced by `@PreAuthorize` (`@EnableMethodSecurity`).

---

## 8. `/h2-console` returns 404 in production

**Problem.** `http://<host>/v1/h2-console` gives `404` on a deployed (Postgres) instance, even though it works locally.

**Cause.** The H2 web console is **dev-only**. `spring.h2.console.enabled: true` (path `/h2-console`) is set only under the `dev` profile block in `application.yml`; the `postgres` profile has no H2 on the classpath's active datasource and never registers the console servlet. (Spring Security *permits* `/h2-console/**` at the filter layer regardless — the 404 comes from the servlet simply not existing, not from an auth block.)

**Fix.** This is correct behavior — there is no browsable DB console in production by design. To inspect a Postgres deployment, connect a real client to the database directly:

```bash
psql "postgresql://sidequest:<password>@<host>:5432/sidequest"
```

Only use the H2 console when running the local `dev` profile (`http://localhost:8080/v1/h2-console`, JDBC URL `jdbc:h2:mem:sidequest`, user `sa`, empty password). Note that Swagger UI (`/v1/docs`) and the OpenAPI JSON (`/v1/api-docs`) are **also disabled** on the `postgres` profile (`springdoc.*.enabled: false`) for the same "don't expose the surface publicly" reason.

---

## 9. A new column or constraint is missing after an entity change (Postgres)

**Problem.** You added/changed a field, index, or constraint on a `@Entity`, redeployed the `postgres` profile, and the change didn't take — a renamed column still shows the old name, a dropped column lingers, or a new `unique`/`not null` constraint isn't enforced.

**Cause.** The `postgres` profile runs Hibernate `ddl-auto: update`, which is **additive only**. It will *add* missing tables, columns, and indexes, but it **never drops or alters** existing ones and **won't tighten** a nullable column to `NOT NULL` on data that violates it. So renames read as "add new + orphan old", and constraint tightening is silently skipped. (This is intentional — the platform rule is *never destroy existing data unless explicitly instructed*.)

**Fix (today).** For additive changes, `update` is enough — just redeploy. For anything non-additive (rename, drop, type change, adding a constraint to existing data), apply the DDL by hand against the database, in a transaction, after backing up:

```sql
BEGIN;
ALTER TABLE match_round RENAME COLUMN old_name TO new_name;
-- backfill / validate, then:
ALTER TABLE match_round ALTER COLUMN new_name SET NOT NULL;
COMMIT;
```

**Fix (eventual).** The documented next step is a real migration tool — **Flyway** — so schema changes are versioned, ordered, and non-additive changes are expressed explicitly rather than by hand. Until that lands, treat `ddl-auto: update` as "adds the easy stuff, you own the rest." The `dev` profile sidesteps this entirely with `create-drop` (schema rebuilt from the entities on every boot — which is also why dev data never persists across restarts).

---

## Still stuck?

- **Check the profile first.** A surprising share of "it works locally but not deployed" issues are just `dev` vs `postgres` differences (in-memory H2 vs Postgres, seeded demo data vs empty, H2 console + Swagger on vs off, fail-fast guards on vs off). `env | grep SPRING_PROFILES_ACTIVE` and re-read the split in `application.yml`.
- **Health check.** `curl -fsS http://localhost:8080/v1/actuator/health` — the same probe the container `HEALTHCHECK` uses. The mail health indicator is deliberately disabled, so an SMTP outage won't flip this to `DOWN`.
- **Read the startup log top-to-bottom.** The dev-profile banner, the JWT dev-secret security warning, and both fail-fast `IllegalStateException`s all fire in the first lines of the log and tell you exactly what's misconfigured.
