# API reference

The complete REST + WebSocket surface. All REST paths are under the context path **`/v1`** (e.g.
`POST /v1/auth/login`); paths below omit the `/v1` prefix for brevity. There are **118 endpoints** across
15 controllers.

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
- **Interactive docs.** Swagger UI at **`/v1/docs`** and the OpenAPI JSON at **`/v1/api-docs`** — enabled
  on the `dev` profile, disabled under `postgres`.

## Auth — `/auth`

| Method + path | Purpose |
|---|---|
| `POST /auth/register` | Create an UNVERIFIED account; emails a 6-digit OTP (HTTP 202, no session yet) |
| `POST /auth/verify-email` | Consume the OTP → verify the account and issue the first session |
| `POST /auth/resend-verification` | Re-send the verification OTP (throttled) |
| `POST /auth/login` | Email/phone + password → `{ accessToken, refreshToken }` (403 if unverified) |
| `POST /auth/google` | Verify a Google `id_token` server-side and sign in / link |
| `POST /auth/forgot-password` | Send a password-reset OTP |
| `POST /auth/reset-password` | Consume the OTP → set a new password (revokes refresh tokens) |
| `POST /auth/refresh` | Rotate the refresh token → a new access token |
| `POST /auth/logout` | Revoke the current refresh token |
| `GET  /auth/me` | The signed-in user + linked player |

## Players — `/players`

| Method + path | Purpose |
|---|---|
| `GET  /players` | Directory (paginated; filter by franchise / game / status) |
| `GET  /players/{id}` | Full profile (private contact fields per-viewer) |
| `GET  /players/{id}/matches` | The player's franchise's match history |
| `GET  /players/{id}/usernames` | Per-game handles (owner/admin see private ones) |
| `PATCH /players/{id}` | Owner/admin edit (contact, privacy, per-game proficiencies; **gamerTag/email are immutable**) |
| `PATCH /players/{id}/status` | **ADMIN** — set a player's status (e.g. VERIFIED) |

## Franchises — `/franchises`

| Method + path | Purpose |
|---|---|
| `GET  /franchises` | League table (paginated; filter by active/season) |
| `GET  /franchises/{id}` | Detail + stats |
| `GET  /franchises/{id}/roster` | Roster (contact + tags visible to leadership/admin) |
| `PUT  /franchises/{id}/roster/{playerId}/tags` | Set a roster player's franchise-private tags (leadership) |
| `GET  /franchises/{id}/matches` | Played matches + results |
| `POST /franchises` · `PATCH /franchises/{id}` | **ADMIN** create / update |
| `PATCH /franchises/{id}/branding` | Owner/admin set logo + banner |
| `POST /franchises/{id}/roster` | **ADMIN** assign a player to a roster |
| `POST /franchises/{id}/owner` · `/manager` | Set franchise leadership |
| `GET  /franchises/{id}/eligible-owners` | Candidates for ownership |
| `POST /franchises/from-proposal/{registrationId}` | **ADMIN** form a franchise from a proposal |
| `POST /franchises/{id}/discard` · `/restore` | **ADMIN** soft-remove / restore |
| `GET  /franchises/mine` | The caller's franchise (owner/manager) |
| `GET  /franchises/invites/mine` · `GET /franchises/{id}/invites` | Leadership invites |
| `POST /franchises/{id}/invites` · `/invites/{inviteId}/accept` · `/reject` | Invite flow |

## Games — `/games`

`GET /games`, `GET /games/{id}` (public; each carries its scoring config: points-per-kill, placement
ladder, standings weight) · `PATCH /games/{id}` (**ADMIN** — edit config; a weight change re-weights the
live standings).

## Matches — `/matches`

| Method + path | Purpose |
|---|---|
| `GET  /matches` | Fixtures (paginated; filter by status/game/season/franchise, free-text search) |
| `GET  /matches/{id}` | Detail (+ scoring snapshot) |
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
| `GET  /registrations` · `GET /registrations/{id}` | **ADMIN** queue / detail |
| `POST /registrations/{id}/reject` | **ADMIN** discard (→ REJECTED) |

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
| `POST /auctions` · `PATCH /auctions/{id}` | **ADMIN** create / configure (DRAFT/LOBBY) |
| `POST /auctions/{id}/lock-pool` | **ADMIN** freeze the pool (also closes the AUCTION registration call) |
| `POST /auctions/{id}/open-hall` · `/start` · `/pause` · `/resume` · `/complete` · `/cancel` | **ADMIN** lifecycle |
| `POST /auctions/{id}/join` | Owner/manager joins the hall |
| `POST /auctions/{id}/nominate` · `/finalize` · `/unsold` | **ADMIN** run the block |
| `POST /auctions/{id}/assign` · `/reauction` · `/funds` | **ADMIN** force-sell / re-queue / top up a purse |
| `POST /auctions/{id}/bid` | Owner/manager places a bid (LIVE only) |

## Disputes, Notifications, Media

- **Disputes:** `POST /disputes` (raise — result challenge / appeal / general; notifies admins),
  `GET /disputes/mine`. Admin triage lives under `/admin/disputes` (below).
- **Notifications:** `GET /notifications` (paginated), `GET /notifications/unread-count`,
  `POST /notifications/{id}/read`, `POST /notifications/read-all`.
- **Media:** `POST /media` (auth — base64 upload, magic-byte sniff, per-kind size caps → stored as a DB
  blob, returns `/media/{id}`), `GET /media/{id}` (public, `Cache-Control: immutable`).

## Admin & Settings

- `GET /admin/overview` (**ADMIN** — KPIs + recent audit activity), `GET /admin/disputes`,
  `POST /admin/disputes/{id}/resolve` (notifies the raiser), `GET /admin/team`.
- `GET /settings` · `PATCH /settings` (**ADMIN** — league settings: season pointer, registration-lock
  window).

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
