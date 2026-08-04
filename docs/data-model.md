# Data model

The persistent shape of Side Quest: 34 JPA `@Entity` classes and 17 enums under
`com.sidequest.arena.model`, their relationships, and the invariants that keep history immutable and
standings correct.

**See also:** [./architecture.md](./architecture.md) (request flow, scoring, concurrency, seasons) ·
[./caching-hld.md](./caching-hld.md) (Caffeine cache design — not duplicated here) ·
[./structure.md](./structure.md) (package layout) · [../CLAUDE.md](../CLAUDE.md) (conventions and
invariants this repo enforces).

---

## Conventions

- **All entities live in `model/`**; Spring Data repositories in `repo/` (34 of them). DTO records at
  the API boundary — entities are never serialized to clients directly.
- **`BaseEntity`** (`@MappedSuperclass`) gives most entities a `UUID` primary key
  (`GenerationType.UUID`) plus `created_at` / `updated_at` `Instant`s maintained by `@PrePersist` /
  `@PreUpdate` callbacks. Three types deliberately do **not** extend it:
  - `PlayerFranchiseHistory` — own `UUID id` + `recorded_at` (a write-once snapshot, no `updated_at`).
  - `SeasonStanding` — extends `BaseEntity`, but is otherwise a frozen value-copy (see invariants).
  - `LeagueSettings` — a singleton keyed by a fixed `String id = "default"`, not a UUID.
- **Enums are persisted as `@Enumerated(EnumType.STRING)`** with an explicit `length` — readable in the
  DB and safe to reorder in code (values are matched by name, not ordinal).
- **Schema management:** `dev` profile runs H2 with `ddl-auto: create-drop` (+ a `DataSeeder` demo
  league, Season 04 / `S04`); `postgres` runs `ddl-auto: update` (additive only — Flyway is the
  eventual answer for non-additive changes). Columns like `MediaAsset.data` are mapped as a
  length-bounded `byte[]` (not `@Lob`) so the type is portable: `VARBINARY` on H2, `bytea` on Postgres.

---

## Domain map

| Domain | Entities |
|--------|----------|
| Identity | `User`, `Player`, `RefreshToken`, `OtpCode` |
| Franchises | `Franchise`, `FranchiseInvite`, `FranchisePlayerTag`, `PlayerFranchiseHistory` |
| Games | `Game`, `PlayerGameProficiency`, `PlayerGameUsername`, `GameVote` |
| Matches | `Match`, `MatchParticipant`, `MatchLineup`, `MatchRound`, `MatchRoundResult`, `MatchRoundPlayerResult`, `MatchMessage`, `ResultRow` |
| Registrations | `Registration`, `TeamInvite` |
| Auctions | `Auction`, `AuctionFranchise`, `AuctionLot`, `AuctionBid` |
| Seasons | `Season`, `SeasonStanding` |
| Comms | `Announcement`, `Notification`, `Dispute` |
| System | `MediaAsset`, `LeagueSettings`, `AuditLog` |

---

## Identity

**`User`** (`users`) — an account. `email` unique + required, `phone` optional, `role` (`Role`, default
`PLAYER`), `passwordHash` (BCrypt), and `emailVerified`. `avatarUrl` is an **account-level** avatar
(a `/media/{id}` ref) — the fallback for accounts that have no `Player`, chiefly the league admin, so
they can still set a profile picture. `emailVerified` gates **login** (an unverified account cannot sign
in) and is distinct from `Player.status == VERIFIED`; verifying the email promotes the player too.
Indexes: `idx_users_email` (unique), `idx_users_phone`.

**`Player`** (`players`) — a competitor profile, **1:1 with `User`** (`user_id` unique, not-null).
Optional `@ManyToOne` to `Franchise` (assigned via the auction). Public `gamerTag` (**unique** — see
invariants), `avatarUrl`, `region`, `bio`. Per-field private contact info — `realName`, `phone`,
`contactEmail`, each with its own `*Public` boolean (private by default). `status` (`PlayerStatus`,
default `PENDING`), `points` (career total — **not** season-scoped, see invariants), and
`onboardingRequired` (true only for a fresh SSO account that hasn't picked its username yet; the
`OnboardingGuard` on the client forces it to complete onboarding). Indexes: `idx_players_franchise`,
`idx_players_points`, unique `idx_players_gamer_tag` on `gamer_tag`.

**`RefreshToken`** (`refresh_tokens`) — a rotating refresh token. Stores only the **SHA-256 hash**
(`token_hash`, unique) of the secret, plus `expiresAt` and `revoked`. Rotated on every `/auth/refresh`
(old row revoked, new one issued).

**`OtpCode`** (`otp_codes`) — a one-time 6-digit code for email verification or password reset. Stores
only the SHA-256 hash (`code_hash`), a `purpose` (`OtpPurpose`), `expiresAt`, single-use `consumed`
flag, and an `attempts` cap. Index: `idx_otp_email_purpose` on `(email, purpose)`.

## Franchises

**`Franchise`** (`franchises`) — a team. `name` and `tag` (≤16 chars) are each **unique league-wide**
(`uk_franchises_name` / `uk_franchises_tag` — reserved even after a franchise is discarded), optional
`ownerPlayer` and `managerPlayer` (`@ManyToOne` to `Player`; owner holds owner+manager permissions, ≤1
manager), `seasonId` (the season `code` it belongs to), `logoUrl` / `bannerUrl` (each a `/media/{id}`
ref — the logo is 1:1, the banner 4:1, cropped client-side before upload), `points` + `rank`
(season-scoped, recomputed by the scoring engine), and `active` (season ongoing vs finished). Roster is
the inverse of `Player.franchise` (Franchise 1—N Player).

**`FranchiseInvite`** (`franchise_invites`) — an ownership/management handshake. Owner (or admin) invites
a `Player` into the `OWNER` or `MANAGER` slot (`FranchiseRole`); invitee accepts/rejects (`InviteStatus`,
default `PENDING`). Mirrors the squad `TeamInvite` flow. Indexes on franchise and invited player.

**`FranchisePlayerTag`** (`franchise_player_tags`) — a franchise-private label (e.g. "Valorant 1")
scoped to `(franchise, player)`. Never carried across when a player changes franchise. Indexes:
`idx_fpt_franchise`, `idx_fpt_franchise_player`.

**`PlayerFranchiseHistory`** (`player_franchise_history`) — a **frozen** record of one player's
membership on a franchise for a season, written when a season is finished (before rosters reset). Stores
value copies (`playerGamerTag`, `franchiseName`, `franchiseTag`, `seasonCode`, `role`, `recordedAt`) — no
FKs, so it survives roster resets. Indexes on `season_code`, `player_id`, `franchise_id`.

## Games

**`Game`** (`games`) — a supported title. `name` (unique), `format`, `gameType` (`GameType`, default
`TACTICAL`), `iconUrl`, `enabled`, `popularity` (0–100). **`popularity` is community-vote-derived, not
admin-set** — `round(100 × distinct voters for this game / distinct total voters)`, recomputed and
persisted on every vote save (see `GameVote` + invariants). Per-title scoring "meta": `pointsPerKill`,
`placementPoints` (CSV ladder, highest-first, empty = kills only), and `standingsWeight` (basis points,
100 = 1.00×) toward overall standings. These seed each new fixture's snapshot at creation; `GameType`
supplies the default ladder (`usesPlacement()` → `"15,12,10,8,6,4,2,1"`).

**`GameVote`** (`game_votes`) — one upvote: a `User` likes a `Game`. Two `@ManyToOne`s, unique
**`uk_user_game_vote`** on `(user_id, game_id)` (a user either upvotes a game or not — never twice, so a
vote is idempotent) + index on `game_id` (per-game tallies). These rows are the sole source of each
`Game.popularity`; the recompute is serialised by an app lock held across its commit so concurrent voters
converge (single-node). See [./api.md](./api.md) `PUT /games/votes`.

**`PlayerGameProficiency`** (`player_game_proficiencies`) — Player N—N Game skill. `rating` (0–100),
optional `rankTier` (free-form), `kd`, `accountLevel`. Unique `uk_player_game` on `(player_id, game_id)`.

**`PlayerGameUsername`** (`player_game_usernames`) — a player's per-`Game` handle, with an `isPublic`
visibility flag. Index `idx_pgu_player`.

## Matches

**`Match`** (`matches`) — a scheduled fixture for a `Game`. `scheduledAt`, `status` (`MatchStatus`),
`matchType` (`MatchType` — `FRANCHISE` pulls players from franchise rosters, `FFA` from approved
registrations), `seasonId`, `arena`, `format`, a live `roomId` (set when started, cleared on end), a
per-match scoring snapshot (`pointsPerKill` + `placementPoints`, defaulted from settings/game),
`resultsPublishedAt` (makes the scoring job idempotent), and a unique **`slug`** (`<game>-<date>-<hex>`,
assigned on first persist via `@PrePersist`) that backs the pretty `/match/<slug>` URL. Indexes:
`idx_matches_status_scheduled`, `idx_matches_game`, `idx_matches_season`; unique on `slug`.

The result graph splits by depth and by match type:

| Entity | Table | Role |
|--------|-------|------|
| `MatchParticipant` | `match_participants` | Match N—N Franchise join. Unique `uk_match_franchise` on `(match_id, franchise_id)`. |
| `MatchLineup` | `match_lineups` | The specific players a franchise fields for a match. If any lineup rows exist, result entry uses that subset, not the full roster. Unique `uk_match_franchise_player` on `(match_id, franchise_id, player_id)`. |
| `MatchRound` | `match_rounds` | One round/map of a multi-round match (`roundNumber`, `mapName`, `mode`). Single-result games have no rounds. |
| `MatchRoundResult` | `match_round_results` | One entrant's per-round line (`rank`, `kills`, `survivalSeconds`, `placePts`). `franchise` set for `FRANCHISE`, `player` for `FFA` — exactly one. Summed across rounds → `ResultRow`. |
| `MatchRoundPlayerResult` | `match_round_player_results` | Optional per-player breakdown within a round (`kills`, `survivalSeconds`). When present, a franchise's round kills = sum of its players'. |
| `ResultRow` | `result_rows` | The published per-entrant result line (`kills`, `placePts`, `total`, `rank`). `franchise` XOR `player`. This is the retained source the scoring engine recomputes from. |
| `MatchMessage` | `match_messages` | Durable admin-posted messages in a live match room (`author` → `User`, `body`). Persisted so late joiners see history (unlike the ephemeral WebSocket layer). |

## Registrations

**`Registration`** (`registrations`) — an application to the league. `type` (`RegistrationType`),
`player` (applicant / squad captain), `squadName` / `franchiseTag`, optional `match` + `game` links,
an `@ElementCollection` `games` list (side table `registration_games`), `contact`, `teamSize`,
`status` (`RegistrationStatus`, default `PENDING`), a `consumed` flag (an `AUCTION` entry drawn into a
completed auction is excluded from later pools), a `hidden` flag (a *soft-hide* so a player can remove a
terminal registration from their own "My Team" history without breaking squad-invite FKs), plus
`reviewedBy` / `reason`. Indexes on player, match, and `(type, status)`. Note: match (`PLAYER`/`SQUAD`)
registrations no longer pass through an admin approval queue — they are live from creation and auto-lock
before the match; `PENDING`/`APPROVED` now apply only to `FRANCHISE`-creation proposals. The **standing
auction pool** is exactly the `type=AUCTION, status=ACTIVE, consumed=false, franchise=null` set — it
exists before any `Auction` is created and is what `GET /auctions/pool` surfaces.

**`TeamInvite`** (`team_invites`) — a squad invitation. Captain invites a `Player` onto a SQUAD
registration; invitee accepts/declines (`InviteStatus`). One row per `(registration, invited player)`,
backstopped by unique **`uk_team_invite_target`** on `(registration_id, invited_player_id)` so a
double-click can't create two rows. Indexes on registration and invited player.

## Auctions

**`Auction`** (`auctions`) — a pre-season player auction. `title`, optional `seasonId`, `status`
(`AuctionStatus`), server-authoritative config: `basePrice`, `bidTimerSeconds`, `antiSnipeSeconds` (10),
`raiseIncrements` (CSV, e.g. `"10,50,100,200,500"`), `defaultBudget`, `intermissionSeconds` (4). Runtime
state: `scheduledAt`, `intermissionUntil` (between-lots gate), `poolLockedAt` (freezes the registration
pool), `createdBy`.

**`AuctionFranchise`** (`auction_franchises`) — a franchise's purse in an auction. `budget` (allotment)
vs `balance` (remaining), `joined` + `joinedAt` (hall presence), and an **optimistic `@Version`** guarding
concurrent debits. Unique `uk_auction_franchise` on `(auction_id, franchise_id)`.

**`AuctionLot`** (`auction_lots`) — one player up for auction. `status` (`AuctionLotStatus`,
≤1 `ON_BLOCK` per auction), `currentBid` + `currentBidder`, `soldTo` + `soldPrice`, `bidOpensAt`
(review window) + `bidDeadline` (auto-finalize countdown), `lotOrder`, and an optimistic `@Version`.
Unique `uk_auction_player` on `(auction_id, player_id)`; index `idx_auction_lots_auction_status`.

**`AuctionBid`** (`auction_bids`) — an **append-only** ledger entry: one accepted bid (`lot`, `bidder`,
`placedBy` user, `amount`). Never mutated. Index `idx_auction_bids_lot`.

## Seasons

**`Season`** (`seasons`) — a competitive season. `code` (unique, e.g. `"S04"` — used as the `seasonId`
across franchises/matches), `name`, `status` (`SeasonStatus`; exactly one `ACTIVE`), `startedAt`,
`endedAt`. Finishing a season snapshots final standings into `SeasonStanding`.

**`SeasonStanding`** (`season_standings`) — a **frozen value-copy** of one franchise's final standing in
a finished season: `seasonCode`, `franchiseId`, `franchiseName`, `franchiseTag`, `points`, `rank` (all
plain columns, no live FK). Unique **`uk_season_standing`** on `(season_code, franchise_id)`; index
`idx_season_standings_code`.

## Comms

**`Announcement`** (`announcements`) — a league-feed post. `category` (`AnnouncementCategory`), `title`,
`body`, optional `match`, `author`, `publishedAt`, and a unique **`shortCode`** (8-char base64url,
assigned on first persist via `@PrePersist`) that backs the `/announcements/<shortCode>` read page.
Doubles as a **registration call**: when `registrationOpen` is true it opens sign-ups with a
`registrationType` (`PLAYER`/`SQUAD`), optional `game`, and squad `teamSize`. (Registration windows are
per-announcement, not a per-game switch.) Non-pinned posts older than 30 days are purged by a daily job.

**`Notification`** (`notifications`) — an in-app notification to one `User`. `type` (`NotificationType`),
`title`, `body`, optional `linkUrl`, `read` flag. Indexes `idx_notifications_user` and
`idx_notifications_user_read` on `(user_id, is_read)` (backs the unread-count badge).

**`Dispute`** (`disputes`) — a challenge for admin triage. `category` (`DisputeCategory`; `RESULT`
references a `match`, `APPEAL`/`GENERAL` don't), `raisedBy`, `reason`, `status` (`DisputeStatus`),
`resolution`, `resolvedBy`, `resolvedAt`.

## System

**`MediaAsset`** (`media_assets`) — a small image stored **inline as DB bytes** (avatar / logo / banner),
served at `GET /media/{id}`. `data` (`byte[]`, `length = 300_000` — comfortably above the 256KB banner
cap), `contentType`, `sizeBytes`, `kind`, `uploadedBy`. **No S3 / external object store** — a deliberate
choice to keep hosting cheap; the trade-off is DB size and no CDN.

**`LeagueSettings`** (`league_settings`) — singleton config (`id = "default"`). `seasonId` / `seasonName`
and `registrationLockHours` (hours before a match its registration locks). Scoring lives per-`Game`, not
here.

**`AuditLog`** (`audit_logs`) — append-only trail of admin actions: `actorId`, `actorEmail`, `action`
(a stable code like `game.update` / `admin.appoint` that the admin "recent activity" UI maps to a
readable label), `entityType` + `entityId`, `detail`. A daily job purges entries older than **7 days**
(a deliberately short window — the trail only feeds the recent-activity panel). Indexes `idx_audit_actor`
and `idx_audit_entity` on `(entity_type, entity_id)`.

---

## Enums (17)

| Enum | Values |
|------|--------|
| `Role` | `PLAYER`, `FRANCHISE_MANAGER`, `FRANCHISE_OWNER`, `ADMIN` |
| `PlayerStatus` | `PENDING`, `VERIFIED`, `FLAGGED`, `SUSPENDED` |
| `GameType` | `BATTLE_ROYALE`, `TACTICAL`, `SPORTS`, `FIGHTING`, `PARTY` |
| `MatchStatus` | `SCHEDULED`, `LIVE`, `AWAITING_RESULT`, `COMPLETED`, `CANCELLED` |
| `MatchType` | `FRANCHISE`, `FFA` |
| `RegistrationType` | `PLAYER`, `SQUAD`, `FRANCHISE`, `AUCTION` |
| `RegistrationStatus` | `FORMING`, `ACTIVE`, `LOCKED`, `PENDING`, `APPROVED`, `REJECTED`, `WITHDRAWN` |
| `AuctionStatus` | `DRAFT`, `LOBBY`, `LIVE`, `PAUSED`, `COMPLETED`, `CANCELLED` |
| `AuctionLotStatus` | `QUEUED`, `ON_BLOCK`, `SOLD`, `UNSOLD` |
| `SeasonStatus` | `ACTIVE`, `FINISHED` |
| `DisputeStatus` | `OPEN`, `RESOLVED`, `DISMISSED` |
| `DisputeCategory` | `RESULT`, `APPEAL`, `GENERAL` |
| `NotificationType` | `GENERAL`, `REGISTRATION`, `MATCH`, `RESULT`, `ANNOUNCEMENT`, `AUCTION` |
| `AnnouncementCategory` | `GENERAL`, `RESULT`, `RECAP`, `MATCH`, `ROSTER`, `AUCTION` |
| `InviteStatus` | `PENDING`, `ACCEPTED`, `REJECTED`, `EXPIRED` |
| `FranchiseRole` | `OWNER`, `MANAGER` |
| `OtpPurpose` | `VERIFY_EMAIL`, `RESET_PASSWORD` |

`GameType` carries behaviour: `usesPlacement()` (`BATTLE_ROYALE`/`PARTY` are placement-scored) and
`defaultPlacementPoints()` seed a new fixture's ladder.

---

## Key invariants

1. **`SeasonStanding` and `PlayerFranchiseHistory` are frozen history.** Both are value-copies written
   when a season finishes; they hold denormalized names/tags/points, not live FKs, so editing or
   discarding a live franchise afterward never rewrites the archive. The all-time franchise table sums
   `SeasonStanding` rows — hence the **`uk_season_standing`** `(season_code, franchise_id)` constraint:
   a duplicate from two racing `finish()` calls would double-count that season forever.

2. **Franchise points are season-scoped and only recomputed while a season is `ACTIVE`.**
   `ScoringService.recomputeStandings()` is a full, idempotent recompute — franchise points = the sum of
   each franchise's `ResultRow` totals from the active season's matches (per-game weighted by
   `Game.standingsWeight`, cancelled fixtures excluded), ranked by points desc. **Off-season it skips the
   franchise block**, so a later scoring-weight edit or a match void does **not** retroactively re-weight
   a finished season. New season → clean slate (points reset).

3. **Player career points are NOT season-scoped.** `Player.points` aggregates across every match/season
   and is recomputed unconditionally — it accumulates and never resets, unlike franchise points.

4. **Scoring is recompute-from-history, never delta accumulation.** `ResultRow`s are retained as the
   source of truth; the engine re-derives standings from the full set every publish. `Match`'s
   `resultsPublishedAt` and the idempotent recompute make re-runs safe.

5. **A `TeamInvite` is unique per `(registration, invited_player)`** via `uk_team_invite_target`, so a
   racing/double-clicked invite can't create two rows for the same invitee.

6. **`Game.popularity` is derived from `GameVote`s, never written by an admin.** It is
   `round(100 × distinct game voters / distinct total voters)`, recomputed and persisted on every vote
   save; the recompute is idempotent and serialised by an app lock held **across its commit** so two
   simultaneous voters converge. It is intentionally absent from the create/update-game request DTOs.

7. **Identity uniqueness + immutability.** `gamerTag` is unique **case-insensitively** and, once claimed,
   **immutable** — the only path that ever sets it after signup is the one-time SSO onboarding claim
   (guarded by `Player.onboardingRequired`). `Franchise` `name` and `tag` are each unique league-wide
   (reserved even after discard). A profile is **owner-editable only**: admins and the player's franchise
   owner/manager may *view* every private field (and, for admins, the account email), but only the owner
   can edit — the check keys off the resolved player, not the URL slug.

---

## Constraints and notable indexes

**Unique constraints**

| Name | Table | Columns | Guards |
|------|-------|---------|--------|
| `uk_season_standing` | `season_standings` | `(season_code, franchise_id)` | double-inserted season snapshot |
| `uk_team_invite_target` | `team_invites` | `(registration_id, invited_player_id)` | duplicate squad invite |
| `uk_match_franchise` | `match_participants` | `(match_id, franchise_id)` | franchise added twice |
| `uk_match_franchise_player` | `match_lineups` | `(match_id, franchise_id, player_id)` | duplicate lineup row |
| `uk_player_game` | `player_game_proficiencies` | `(player_id, game_id)` | duplicate proficiency |
| `uk_auction_franchise` | `auction_franchises` | `(auction_id, franchise_id)` | franchise joined twice |
| `uk_auction_player` | `auction_lots` | `(auction_id, player_id)` | same player lotted twice |
| `uk_user_game_vote` | `game_votes` | `(user_id, game_id)` | a user upvoting a game twice (idempotent votes) |
| `uk_franchises_name` · `uk_franchises_tag` | `franchises` | `name` · `tag` | duplicate franchise name/tag (each reserved league-wide) |

Plus column-level uniques: `users.email`, `players.user_id`, **`players.gamer_tag`**
(`idx_players_gamer_tag`, unique — case-insensitive uniqueness enforced in the service), `games.name`,
**`matches.slug`**, **`announcements.short_code`**, `seasons.code`, `refresh_tokens.token_hash`.

**Notable indexes** — `idx_matches_status_scheduled` `(status, scheduled_at)` (the fixture list),
`idx_players_points` (leaderboard), `idx_notifications_user_read` `(user_id, is_read)` (unread badge),
`idx_auction_lots_auction_status` `(auction_id, status)` (current lot on the block),
`idx_registrations_type_status` `(type, status)`, `idx_audit_entity` `(entity_type, entity_id)`.

---

## Concurrency control (two strategies)

The codebase splits concurrency deliberately:

- **Auctions use optimistic locking.** `AuctionFranchise` and `AuctionLot` carry a JPA `@Version`;
  racing bids/finalizes that debit a purse or move a lot off the block collide on the version and retry.
- **Season/match/registration paths use pessimistic row locks + DB unique constraints** — season
  finish/start, result publish on `Match`, and registration exclusivity are closed with `SELECT … FOR
  UPDATE`-style locks (`lockById` / `findByIdForUpdate`) and the unique constraints above, **not**
  `@Version`. See [../CLAUDE.md](../CLAUDE.md) and [./architecture.md](./architecture.md) for the
  rationale.

---

## Limitations

- **`ddl-auto: update` is additive only.** Renames, drops, and column-type changes won't apply cleanly
  on the `postgres` profile — a Flyway migration path is the intended answer for anything non-additive.
- **Media in-DB.** `MediaAsset` bytes bloat the database and bypass any CDN; acceptable at this scale,
  revisit if asset volume grows.
- **Some entity javadoc predates the current flow** (e.g. `Registration`'s "approval queue" comment) —
  the enum-level docs and this page reflect the current behaviour.
