# Testing

How the Side Quest backend is verified: one black-box HTTP integration suite as the automated
safety net, plus an adversarial-review + browser-E2E practice around every change.

**See also:** [./setup.md](./setup.md) · [./status.md](./status.md) ·
[./troubleshooting.md](./troubleshooting.md) · [./caching-hld.md](./caching-hld.md) ·
[../README.md](../README.md) · [../../CLAUDE.md](../../CLAUDE.md)

---

## TL;DR

```bash
./mvnw test
```

Boots the whole Spring context on a random port against a seeded in-memory H2 database and drives
the **real** `/v1` HTTP API. One test class, **26 ordered end-to-end tests**, ~16–17 s wall time.
The report lands at:

```
target/surefire-reports/com.sidequest.arena.SideQuestApiIntegrationTest.txt
target/surefire-reports/TEST-com.sidequest.arena.SideQuestApiIntegrationTest.xml
```

Last green run: `Tests run: 26, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 16.75 s`.

There are **no fine-grained unit tests** — this suite is the correctness net. See
[Limitations](#limitations) for why that is a deliberate (and bounded) choice, not an oversight.

---

## Philosophy: one black-box suite over the real API

The single test file is
[`src/test/java/com/sidequest/arena/SideQuestApiIntegrationTest.java`](../src/test/java/com/sidequest/arena/SideQuestApiIntegrationTest.java)
(~1,100 LOC). It is deliberately **black-box**: it never imports a service or repository and never
touches the domain model. It logs in, gets a JWT, and calls HTTP endpoints exactly as the Next.js
frontend does. Rationale:

- The rules being protected (RBAC, privacy, lifecycle guards, scoring recompute) are the *business
  contract*. Testing them through the wire proves the whole stack — Spring Security filter chain,
  `@PreAuthorize`, the `/v1` context path, JSON (de)serialization with `non_null` inclusion, the
  `{code, message, details}` error envelope — not just a service method in isolation.
- It doubles as living API documentation: each test reads as a scenario a real client would hit.

Key setup details (all in the test class):

| Concern | How it's handled | Why |
|---|---|---|
| Real servlet container | `@SpringBootTest(webEnvironment = RANDOM_PORT)` + `TestRestTemplate` | So the `/v1` `server.servlet.context-path` actually applies; `TestRestTemplate`'s root URI already includes it, so test paths are context-relative. |
| HTTP client | `HttpComponentsClientHttpRequestFactory` (Apache **httpclient5**, a test-scope dep) set per test | The default JDK client throws `HttpRetryException` ("cannot retry due to server authentication, in streaming mode") on **401 POSTs** — which the RBAC tests deliberately trigger. |
| Reading OTP codes | A `@TestConfiguration` supplies a `@Primary` `RecordingEmailSender` that regex-captures the 6-digit code from the email body | Lets the auth tests complete real email-verification / password-reset flows without an SMTP server. |
| Database | Seeded in-memory **H2** (the `dev` profile), schema `create-drop`ped per run | Zero external services; the `DataSeeder` demo league (Season 04) gives realistic fixtures — franchises `RXG`/`MOTI`, players, an open auction, standings. |

---

## What the 26 tests cover

Tests are `@Order`-annotated (`@TestMethodOrder(OrderAnnotation.class)`) because several share and
mutate the one seeded database — a few transitions are **one-way** (finishing a season, locking an
auction pool), so their tests must run last. The order numbers are sparse and grouped by concern.

| `@Order` | Test | What it proves |
|---:|---|---|
| 1 | `contextLoadsAndSeedsCatalog` | App boots; the games catalog is seeded (≥4 titles incl. Valorant). |
| 2 | `publicCatalogReadsDoNotRequireAuth` | Franchises / players / matches / announcements / standings read anonymously. |
| 3 | `seededStandingsRankRxgFirst` | The seeded completed match feeds the standings; RXG ranks #1 with points. |
| 4 | `adminLoginAndMe` | Login → JWT → `/auth/me` returns the `ADMIN` role and email. |
| 5 | `registerVerifyThenLoginNewPlayer` | Register (202, `verificationRequired`) → login blocked `EMAIL_NOT_VERIFIED` (403) → verify with the emailed OTP → player promoted to `VERIFIED`. |
| 6 | `duplicateEmailIsRejected` | Re-registering a taken email → 409 `EMAIL_TAKEN`. |
| 7 | `rbacGuardsFranchiseCreation` | The RBAC matrix in one test: anon **401**, `PLAYER` **403**, `ADMIN` **201**. |
| 8 | `errorEnvelopeOnNotFound` | Unknown id → 404 with `{code:"NOT_FOUND", message, timestamp}`. |
| 9 | `scoringEngineRecomputesOnResultPublish` | Publishing results recomputes the leaderboard (35 > 9 total → rank 1) and flips the match to `COMPLETED`. |
| 10 | `refreshTokenRotationInvalidatesOldToken` | `/auth/refresh` rotates; reusing the old refresh token → 401. |
| 11 | `adminOverviewReportsKpis` | `/admin/overview` KPIs (player totals, pending registrations, open disputes). |
| 20 | `profileContactPrivacyMatrix` | Per-field privacy: private contact fields visible to owner / admin / same-franchise leader, **null** to spectators and other-franchise leaders. |
| 21 | `selfProfileEditTogglesHandlePrivacyAndRating` | Self-edit flips a game handle to private and updates rating; spectators lose the handle, owner keeps it; editing someone else → 403. |
| 22 | `rosterPrivateFieldsAreLeaderScoped` | Roster contact fields populated only for that franchise's leadership; stripped for spectators and cross-franchise leaders. |
| 23 | `mediaUploadValidatesAndServes` | Media caps: anon upload 401; valid PNG stored → `/media/{id}`, served with sniffed `image/png`; non-image, >32 KB avatar, external/`data:` avatar URLs, and oversized base64 all rejected. |
| 24 | `franchiseBrandingOwnerOrAdminOnly` | Logo/banner is self-service for owner/admin; a plain member → 403; values round-trip. |
| 25 | `auctionEntryDoesNotRepublicizePrivateHandle` | Regression guard: re-entering the auction pool with no handle must **not** re-publicize a deliberately-private handle. |
| 26 | `playerCanWithdrawOwnRegistration` | Self-withdrawal marks the registration `WITHDRAWN` (neutral, not `REJECTED`), frees re-entry; another player can't cancel it (403). |
| 30 | `otpWrongCodeReplayAndForgotPassword` | Wrong OTP → 400; correct works once, replay → 400; forgot-password never leaks existence (204 for unknown & known); reset rotates the password. |
| 40 | `matchRoomLifecycleAndVisibility` | Full room lifecycle: lineup notifies the player; room 401 pre-start; `/start` → `LIVE`; participant reads lobby, non-participant 403; admin-only messages; `/end` → `AWAITING_RESULT` (room closed); past-time reschedule 400; delete RBAC. |
| 41 | `completedMatchDeletionRestoresStandings` | Deleting a completed match recomputes standings back to the prior total. |
| 42 | `matchLifecycleGuards` | State machine: PATCH can only `CANCELLED` (not force `LIVE`); cancelled can't start; a completed fixture locks start/reschedule/edit but **can** be cancelled (points drop out); cancelled is terminal — re-publishing results can't resurrect it. |
| 43 | `perGameScoringConfigAndWeight` | Public scoring config; changing a game's `standingsWeight` re-weights its live contribution (heavier → up, zeroed → gone); malformed ladder / out-of-range weight rejected. |
| 44 | `rosterPlayerTagsLeaderScoped` | Franchise-private roster tags: set by leadership only, de-duped, hidden from everyone else; list cap 20 / per-tag 40 chars enforced. |
| 46 | `lockPoolClosesAuctionRegistrationCall` | Locking the auction pool has the same public effect as closing the registration call (`registrationOpen=false`) and rejects new applies. **One-way** for the seeded auction. |
| 90 | `finishedSeasonMatchCannotBeVoided` | Finishing the active season (one-way) freezes its matches: cancel and delete are both refused, because the recompute engine never rewrites finished-season standings. |

The theme across the suite: **RBAC** (401 anon / 403 wrong role / 200 right role), **privacy**
(owner/admin/leader vs. spectator), **lifecycle guards** (what each transition does and doesn't
allow), and **scoring recompute** as the source of truth for standings.

---

## Running it

```bash
# Full suite (compiles + boots the context once, runs all 26 tests):
./mvnw test

# A single test class (there is only one today):
./mvnw test -Dtest=SideQuestApiIntegrationTest

# A single method:
./mvnw test -Dtest='SideQuestApiIntegrationTest#scoringEngineRecomputesOnResultPublish'
```

Notes:

- No profile needs to be set — the suite runs under the default `dev` profile (H2 + seeder), so it
  needs **no** database, SMTP, or Google credentials.
- The Docker image builds with `-DskipTests` (see the [`Dockerfile`](../Dockerfile)); tests are meant
  to run in CI / locally, not inside the release build stage.
- Read results in `target/surefire-reports/` (the `.txt` for a human summary, the `.xml` for CI).

---

## The broader QA practice

The automated suite is the floor, not the ceiling. Around every non-trivial change this project also
runs (per [../../CLAUDE.md](../../CLAUDE.md), the "Testing Workflow" and "Browser Automation"
sections):

1. **Adversarial multi-agent code review** ("ultracode") on new code — a deliberate second pass that
   hunts for the failure classes this codebase has actually hit: race conditions on concurrent
   writes (now guarded by pessimistic locks + unique constraints), `"" ?? null` empty-vs-absent
   confusion, bean-cycle traps, and privacy leaks in shared writers.
2. **Playwright browser E2E** against a running dev stack (backend `:8080` + frontend `:3000`)
   before anything is called done: loading / empty / error states, dark & light themes, mobile
   overflow, dialogs, plus a console-and-network check. Failures get a screenshot and a fix attempt
   before they're reported.

These are process, not committed test files — they don't show up in `./mvnw test`.

---

## Where correctness actually comes from

Because there is a single suite, the design leans on two backstops so correctness *self-heals*
rather than depending on exhaustive test enumeration:

- **Recompute-from-history idempotency.** Standings are never mutated incrementally. Every result
  publish, match void, or delete triggers `ScoringService` to recompute the current season's table
  from the surviving result rows (and evicts the read caches — see
  [./caching-hld.md](./caching-hld.md)). Tests 9, 41, and 42 assert the round-trip: adding then
  removing a match returns standings to the *exact* prior total. A missed increment can't drift the
  table, because there is no increment.
- **Database constraints + lifecycle guards.** Uniqueness (emails, tags), one-way state transitions
  (finished season, locked pool, terminal `CANCELLED`), and pessimistic locking on the contended
  writes are enforced at the persistence / service layer, so even an untested caller path can't
  violate them.

---

## Codebase snapshot (what the suite sits on top of)

Grounding numbers, from the current tree (`find`/`grep` over
`src/main/java/com/sidequest/arena`):

| Metric | Count |
|---|---:|
| Main `.java` files | 238 |
| Main LOC | ~16,820 |
| Spring Data repositories (`repo/`) | 33 |
| `@Entity` classes | 38 |
| Enums (`model/`) | 17 |
| `*Controller` classes | 15 |
| REST endpoints (`@{Get,Post,Put,Patch,Delete}Mapping`) | 118 |
| Integration test files | 1 |
| Integration tests (`@Test` methods) | 26 |

Stack under test: **Java 21 / Spring Boot 3.3.4**, JPA (Hibernate), Spring Security with
`@EnableMethodSecurity` + `@PreAuthorize`, **jjwt 0.12.6** Bearer tokens + BCrypt (roles
`PLAYER` / `FRANCHISE_MANAGER` / `ADMIN`), Caffeine caches (evict-on-write, 45 s TTL), raw WebSocket
hubs under `/ws/live/*`, DB-blob media (`MediaAsset`), and the `{code, message, details}` error
envelope from `common/GlobalExceptionHandler`. Test deps: `spring-boot-starter-test`,
`spring-security-test`, `httpclient5`.

---

## Limitations

Honest about what this does **not** cover — budget accordingly before shipping:

- **No unit tests.** Nothing exercises a service or repository in isolation, so a regression is only
  caught if it changes observable HTTP behaviour that a test happens to assert. Pure-logic edge cases
  (e.g. every branch of the placement-ladder parser) are under-covered.
- **Single shared-state suite.** All 26 tests run against one mutating H2 instance in a fixed order;
  the one-way transitions (season finish `@Order(90)`, pool lock `@Order(46)`) mean you can't
  freely reorder or run an arbitrary subset without understanding the dependencies. It is not
  parallel-safe as written.
- **H2, not PostgreSQL.** Tests run against H2 in `MODE=PostgreSQL`. This catches most SQL/JPA
  issues but **not** Postgres-specific behaviour (real isolation levels, native types, the Hikari
  pool, `ddl-auto: update` migration drift). The `postgres` profile is validated via
  docker-compose, not by this suite.
- **No WebSocket / realtime coverage.** The `/ws/live/*` hubs and `RealtimeService` pub/sub are not
  exercised here — realtime is verified manually via Playwright.
- **No load / concurrency tests.** The concurrency guards (pessimistic locks, unique constraints)
  are asserted for *correctness of outcome*, not under contention. Race behaviour is reasoned about
  and reviewed, not stress-tested.

Next steps if the suite needs to grow: split into per-feature test classes with isolated
transactional fixtures, add a Testcontainers PostgreSQL profile for the persistence-sensitive paths,
and introduce targeted unit tests for the parser/scoring math that black-box tests can only reach
indirectly.
