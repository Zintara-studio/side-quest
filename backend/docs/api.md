# API reference

The complete REST + WebSocket surface. All REST paths are under the context path **`/v1`** (e.g.
`POST /v1/auth/login`); paths below omit the `/v1` prefix for brevity. There are **129 endpoints** across
16 controllers.

**See also:** [architecture.md](./architecture.md) · [data-model.md](./data-model.md) ·
[setup.md](./setup.md) · [../README.md](../README.md)

## Conventions

- **Auth.** A bearer JWT (`Authorization: Bearer <accessToken>`) identifies the caller. Roles are
  `PLAYER` / `FRANCHISE_MANAGER` / `ADMIN`. As a rule: **public catalog reads are open**, **any mutation
  needs a token**, and **admin operations require `ADMIN`** (enforced with `@PreAuthorize` method
  security). Ownership rules (e.g. "only the franchise owner", "only your own registration") are checked
  in the service and return **403** on violation, **401** when unauthenticated.
- **Errors.** Failures return the envelope `{ "code": "...", "message": "...", "details": {...}, "path",
  "timestamp" }` with an appropriate HTTP status (e.g. `VALIDATION_ERROR` 400, `INVALID_CREDENTIALS` 401,
  `EMAIL_NOT_VERIFIED` 403, conflicts 409).
- **Pagination.** List endpoints that paginate take `limit` + an opaque `cursor` (base64 offset) and
  return `{ items, nextCursor, limit }`. Pass `nextCursor` back to fetch the next page.
- **Slug-or-UUID paths.** Public detail endpoints accept **either a pretty slug or the raw UUID** in the
  path segment, resolved server-side: players by `gamerTag`, franchises by `tag`, matches by `slug`
  (`game-date-hex`), announcements by `shortCode` (8-char base64url). The UI builds only slug URLs; the
  UUID form is kept working because older DB-stored links (e.g. in notifications) embed UUIDs. DTOs carry
  the slug/short-code (`slug`, `shortCode`, `matchSlug`) so callers can build clean links.
- **Interactive docs.** Swagger UI at **`/v1/docs`** and the OpenAPI JSON at **`/v1/api-docs`** — enabled
  on the `dev` profile, disabled under `postgres`.

## Auth — `/auth`

| Method + path | Purpose |
|---|---|
| `POST /auth/register` | Create an UNVERIFIED account; the display name **is** the public username (`gamerTag`) and must satisfy the [username rules](#username-rules) (409 on a case-insensitive duplicate, 400 on a bad shape). Emails a 6-digit OTP (HTTP 202, no session yet) |
| `POST /auth/verify-email` | Consume the OTP → verify the account and issue the first session |
| `POST /auth/resend-verification` | Re-send the verification OTP (throttled) |
| `POST /auth/login` | Email/phone + password → `{ accessToken, refreshToken }` (403 if unverified) |
| `POST /auth/google` | Verify a Google `id_token` server-side and sign in / link. A **first-time** SSO account gets a placeholder username + `onboardingRequired: true` (the client routes it to `POST /players/onboard`) |
| `POST /auth/forgot-password` | Send a password-reset OTP |
| `POST /auth/reset-password` | Consume the OTP → set a new password (revokes refresh tokens) |
| `POST /auth/refresh` | Rotate the refresh token → a new access token |
| `POST /auth/logout` | Revoke the current refresh token |
| `GET  /auth/me` | The signed-in user + linked player. The user view carries `avatarUrl` (account-level, used when there is no player); the player view carries `onboardingRequired` |

<a id="username-rules"></a>**Username rules.** The `gamerTag` is 3–20 chars, `[A-Za-z0-9_.-]`, **no spaces**, and unique **case-insensitively** (`sammy` == `Sammy`). It is claimed once and is then immutable — the sole exception is the one-time SSO onboarding claim (`POST /players/onboard`). `GET /players/username-available` powers the live signup/onboarding check.

## Players — `/players`

| Method + path | Purpose |
|---|---|
| `GET  /players` | Directory (paginated; filter by franchise / game / status) |
| `GET  /players/username-available?username=` | **Public** live availability check → `{ available, reason }` (shape + case-insensitive uniqueness) |
| `POST /players/onboard` | First-time SSO onboarding — claim the immutable username + apply the optional profile; only while `onboardingRequired` (else 409). The ONE path that sets a `gamerTag` after signup |
| `GET  /players/{id}` | Full profile — `{id}` is a **gamerTag or UUID**. Private contact fields (realName/phone/contactEmail) and the **account login email** are returned only to a *privileged* viewer (the owner, an admin, or an owner/manager of the player's franchise); stripped for everyone else |
| `GET  /players/{id}/matches` | The player's franchise's match history (each row carries `matchSlug`) |
| `GET  /players/{id}/usernames` | Per-game handles (owner/admin see private ones) |
| `PATCH /players/{id}` | **OWNER-ONLY** edit (contact, privacy, avatar, per-game proficiencies). Admins can *view* every field but **cannot edit** another player's profile (403); **gamerTag/email are immutable** |
| `PATCH /players/{id}/status` | **ADMIN** — set a player's status (e.g. VERIFIED) |

## Franchises — `/franchises`

| Method + path | Purpose |
|---|---|
| `GET  /franchises` | League table (paginated; filter by active/season) |
| `GET  /franchises/{id}` | Detail + stats — `{id}` is a **tag or UUID** |
| `GET  /franchises/{id}/roster` | Roster (contact + tags visible to leadership/admin) |
| `PUT  /franchises/{id}/roster/{playerId}/tags` | **SUPER_ADMIN**/leadership — set a roster player's franchise-private tags |
| `GET  /franchises/{id}/matches` | Played matches + results (each carries `matchSlug`) |
| `POST /franchises` · `PATCH /franchises/{id}` | **SUPER_ADMIN** create / update |
| `PATCH /franchises/{id}/branding` | Owner/**SUPER_ADMIN** set logo + banner |
| `POST /franchises/{id}/roster` | **SUPER_ADMIN** assign a player to a roster |
| `POST /franchises/{id}/owner` · `/manager` | **SUPER_ADMIN** set franchise leadership |
| `GET  /franchises/{id}/eligible-owners` | Candidates for ownership |
| `POST /franchises/from-proposal/{registrationId}` | **SUPER_ADMIN** form a franchise from a proposal |
| `POST /franchises/{id}/discard` · `/restore` | **SUPER_ADMIN** soft-remove / restore |
| `GET  /franchises/mine` | The caller's franchise (owner/manager) |
| `GET  /franchises/invites/mine` · `GET /franchises/{id}/invites` | Leadership invites |
| `POST /franchises/{id}/invites` · `/invites/{inviteId}/accept` · `/reject` | Invite flow |

> **Franchise management is `SUPER_ADMIN`-only.** Every franchise mutation (create/update/branding/roster/
> owner/manager/from-proposal/discard/restore/tags) requires the main admin — an *appointed* admin cannot
> run them. (The franchise owner still passes the owner-scoped ones like branding.)

## Games — `/games`

| Method + path | Purpose |
|---|---|
| `GET  /games` · `GET /games/{id}` | Public catalogue; each carries its scoring config (points-per-kill, placement ladder, standings weight) and its **vote-derived** `popularity` |
| `POST /games` | **ADMIN** add a title (scoring defaults from the genre; 409 on a duplicate name). Popularity starts at 0 — it is **not** admin-set |
| `PATCH /games/{id}` | **ADMIN** edit config (a standings-weight change re-weights the live table). **Popularity is not editable here** — it is community-vote-driven |
| `GET  /games/my-votes` | The signed-in user's upvoted game ids (401 if anonymous) — pre-selects the vote UI |
| `PUT  /games/votes` | Replace the caller's whole upvote set (`{ gameIds }`; idempotent), recompute every game's popularity, and return the refreshed catalogue |

**Popularity is community-vote-driven:** `popularity = round(100 × distinct voters for the game / distinct total voters)`, recomputed on every vote save (a global lock serialises the recompute across its commit). See [data-model.md](./data-model.md).

## Matches — `/matches`

| Method + path | Purpose |
|---|---|
| `GET  /matches` | Fixtures (paginated; filter by status/game/season/franchise, free-text search). Each summary carries `slug` |
| `GET  /matches/{id}` | Detail (+ scoring snapshot) — `{id}` is a **slug or UUID** |
| `GET  /matches/{id}/leaderboard` · `/rounds` | Published result table / per-round results |
| `GET  /matches/{id}/players` | FFA entrants for result entry |
| `GET  /matches/my-rooms` · `GET /matches/{id}/room` | The caller's live rooms / one room (participant-gated) |
| `POST /matches/{id}/messages` | **ADMIN** post to the live room |
| `GET  /matches/{id}/lineups` · `PUT /matches/{id}/lineups/{franchiseId}` | Read / set a franchise lineup |
| `POST /matches` · `PATCH /matches/{id}` | **ADMIN** create / patch (the patch owns the CANCELLED/void transition) |
| `POST /matches/{id}/start` · `/end` · `/reschedule` · `DELETE /matches/{id}` | **ADMIN** lifecycle |
| `POST /matches/{id}/results` · `/rounds` | **ADMIN** publish single-result / per-round results → recompute |

Finished-season fixtures are frozen: void/delete/result-entry are refused for them.

## Registrations — `/registrations`

| Method + path | Purpose |
|---|---|
| `POST /registrations` | Apply (solo / squad / FFA / franchise-proposal / auction-pool) |
| `GET  /registrations/mine` · `/invites/mine` | The caller's registrations / squad invites |
| `POST /registrations/{id}/invite` | Captain invites a teammate |
| `POST /registrations/invites/{inviteId}/accept` · `/reject` · `/leave` | Respond / leave a forming squad |
| `POST /registrations/{id}/cancel` | **Player self-service** — withdraw your own registration (→ WITHDRAWN) |
| `DELETE /registrations/{id}` | **Player self-service** — hide your own *terminal* registration from your "My Team" history (soft `hidden` flag; kept for referential integrity) |
| `GET  /registrations` · `GET /registrations/{id}` | **ADMIN** queue / detail |
| `POST /registrations/{id}/reject` | **ADMIN** discard (→ REJECTED) |

An auction/franchise call's `announcementId` in the apply body accepts a **shortCode or UUID**.

## Standings & leaderboards

`GET /standings` (live league table) · `GET /leaderboard/players` (career leaderboard) ·
`GET /leaderboard/games/{id}` (per-game rankings). All public.

## Seasons — `/seasons`

`GET /seasons`, `GET /seasons/current`, `GET /seasons/all-time/standings`, `GET /seasons/{code}/standings`
(live table for the active season; **frozen snapshot** for a finished one) · `POST /seasons/start` /
`/finish` (**ADMIN**; finish snapshots + archives rosters, start resets franchise points).

## Auctions — `/auctions`

| Method + path | Purpose |
|---|---|
| `GET  /auctions/active` · `GET /auctions/{id}` | The active auction / a board (scouting detail is per-viewer) |
| `GET  /auctions/pool` | **Public** — the standing registration pool (players who signed up and are waiting), visible **even when no auction exists yet**. Players are projected into the `AuctionLotView` shape (status `QUEUED`); private scouting fields (real name / contact / handle) are **admin-only** |
| `POST /auctions` · `PATCH /auctions/{id}` | **ADMIN** create / configure (DRAFT/LOBBY) |
| `POST /auctions/{id}/lock-pool` | **ADMIN** freeze the pool (also closes the AUCTION registration call) |
| `POST /auctions/{id}/open-hall` · `/start` · `/pause` · `/resume` · `/complete` · `/cancel` | **ADMIN** lifecycle |
| `POST /auctions/{id}/join` | Owner/manager joins the hall |
| `POST /auctions/{id}/nominate` · `/finalize` · `/unsold` | **ADMIN** run the block |
| `POST /auctions/{id}/assign` · `/reauction` · `/funds` | **ADMIN** force-sell / re-queue / top up a purse |
| `POST /auctions/{id}/bid` | Owner/manager places a bid (LIVE only) |

## Announcements — `/announcements`

`GET /announcements` (paginated league feed) · `GET /announcements/{id}` (`{id}` is a **shortCode or
UUID**; the view carries `shortCode` + the linked `matchSlug`) · `POST /announcements` ·
`PATCH /announcements/{id}` · `POST /announcements/{id}/close` · `DELETE /announcements/{id}` (**ADMIN**;
create/edit/close a registration call / delete). Non-pinned announcements older than 30 days are purged
by a daily job.

## Disputes, Notifications, Media

- **Disputes:** `POST /disputes` (raise — result challenge / appeal / general; notifies admins),
  `GET /disputes/mine`. Admin triage lives under `/admin/disputes` (below).
- **Notifications:** `GET /notifications` (paginated), `GET /notifications/unread-count`,
  `POST /notifications/{id}/read`, `POST /notifications/read-all`. Notifications older than 30 days are
  purged by a daily job.
- **Media:** `POST /media` (auth — base64 upload, magic-byte sniff, per-kind size caps → stored as a DB
  blob, returns `/media/{id}`), `GET /media/{id}` (public, `Cache-Control: immutable`). Images are
  **cropped + downscaled client-side** (avatar/logo 1:1, banner 4:1) before upload, so the stored blob is
  already the display ratio; only a `/media/{id}` reference is ever accepted for an avatar/logo/banner field.

## Admin & Settings

- `GET /admin/overview` (**ADMIN** — KPIs + recent audit activity, human-readable), `GET /admin/disputes`,
  `POST /admin/disputes/{id}/resolve` (notifies the raiser), `GET /admin/team`.
- `PATCH /admin/profile/avatar` (**ADMIN** — set the caller's own *account-level* avatar; for admins with
  no player, chiefly the league admin. Self-scoped; only a `/media/{id}` ref or blank-to-clear).
- `POST /admin/seed` (**SUPER_ADMIN** — idempotently seed the static games catalogue into a live DB, no
  restart), `POST /admin/players/{playerId}/admin` · `DELETE …` (**SUPER_ADMIN** — appoint / revoke an
  appointed admin; revoke immediately kills their sessions).
- `GET /settings` · `PATCH /settings` (**ADMIN** — league settings: season pointer, registration-lock
  window).
- The audit trail behind "recent activity" is append-only and swept daily (7-day retention).

## Realtime — WebSocket (`/ws/live/**`, under `/v1`)

Raw text WebSocket topics served by an in-process pub/sub hub. Browsers can't set an `Authorization`
header on a WebSocket, so authenticated channels take the JWT as a **`?token=` query parameter** (keep
the `/v1` context path in the URL: `ws://host/v1/ws/live/...`).

| Channel | Access |
|---|---|
| `/ws/live/standings` | Live standings ticks (open) |
| `/ws/live/matches/{id}` | Live score updates for a match (open) |
| `/ws/live/auctions/{id}?token=<jwt>` | Live bid updates — **bidders only** (admin or a participating franchise owner/manager); others are closed with 1008 |
| `/ws/live/me?token=<jwt>` | Personal pushes for the authenticated user |

Each frame is JSON `{ "event": "...", ... }` (e.g. `auction.update`, `standings.update`, `subscribed`,
`pong`). Send `"ping"` for a `{"event":"pong"}` heartbeat.
