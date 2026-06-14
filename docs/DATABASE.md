# Database design

PostgreSQL 16 per service, isolated by schema-per-service when colocated,
separate clusters in production. Migrations via Flyway.

Conventions:
- `id BIGSERIAL` (or `UUID` for externally-shared aggregates).
- `created_at`, `updated_at` (auto via trigger), `deleted_at` (soft delete).
- `version INT` for optimistic locking.
- `audit_log` table per service for write-side audit.
- Naming: snake_case, plural table names.
- All FKs indexed.
- `pg_partman` for monthly partitions on hot tables.

---

## 1. auth-service

```sql
CREATE TABLE accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT UNIQUE NOT NULL,
    password_hash   TEXT,                          -- nullable for OAuth-only
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING_VERIFICATION',
    mfa_enabled     BOOLEAN NOT NULL DEFAULT false,
    mfa_secret      TEXT,
    email_verified  BOOLEAN NOT NULL DEFAULT false,
    last_login_at   TIMESTAMPTZ,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    version         INT NOT NULL DEFAULT 0
);

CREATE TABLE oauth_identities (
    id           BIGSERIAL PRIMARY KEY,
    account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    provider     VARCHAR(20) NOT NULL,             -- GOOGLE / DISCORD / RIOT
    provider_uid VARCHAR(255) NOT NULL,
    UNIQUE(provider, provider_uid)
);

CREATE TABLE roles (
    id   SMALLSERIAL PRIMARY KEY,
    name VARCHAR(40) UNIQUE NOT NULL              -- SUPER_ADMIN ... FAN
);

CREATE TABLE account_roles (
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    role_id    SMALLINT NOT NULL REFERENCES roles(id),
    scope      VARCHAR(40),                        -- e.g. franchise:1234
    PRIMARY KEY (account_id, role_id, COALESCE(scope, ''))
);

CREATE TABLE sessions (
    id              UUID PRIMARY KEY,
    account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,             -- only the hash
    device_fingerprint TEXT,
    ip              INET,
    user_agent      TEXT,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    rotated_from    UUID REFERENCES sessions(id)  -- refresh-token rotation chain
);
CREATE INDEX idx_sessions_account ON sessions(account_id) WHERE revoked_at IS NULL;

CREATE TABLE token_blacklist (
    jti        UUID PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE auth_audit (
    id         BIGSERIAL PRIMARY KEY,
    account_id UUID,
    event_type VARCHAR(40) NOT NULL,              -- LOGIN_OK, LOGIN_FAIL, 2FA_OK ...
    ip         INET,
    metadata   JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (occurred_at);
```

## 2. user-service

```sql
CREATE TABLE users (
    id            UUID PRIMARY KEY,               -- mirrors accounts.id
    handle        CITEXT UNIQUE NOT NULL,
    display_name  VARCHAR(60) NOT NULL,
    avatar_url    TEXT,
    country_code  CHAR(2),
    locale        VARCHAR(10),
    bio           TEXT,
    is_pro        BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now(),
    deleted_at    TIMESTAMPTZ,
    version       INT DEFAULT 0
);
CREATE INDEX idx_users_handle_trgm ON users USING gin (handle gin_trgm_ops);
```

## 3. player-service

```sql
CREATE TABLE games (
    id       SMALLSERIAL PRIMARY KEY,
    code     VARCHAR(20) UNIQUE NOT NULL,         -- VALORANT, CSGO2, BGMI ...
    name     VARCHAR(80) NOT NULL,
    roles    JSONB NOT NULL                       -- ["DUELIST","SENTINEL",...]
);

CREATE TABLE players (
    id               UUID PRIMARY KEY,
    user_id          UUID NOT NULL,               -- ref user-service (no FK)
    ign              VARCHAR(40) NOT NULL,
    real_name        VARCHAR(120),
    country_code     CHAR(2),
    primary_game_id  SMALLINT NOT NULL REFERENCES games(id),
    state            VARCHAR(20) NOT NULL DEFAULT 'FREE_AGENT',
    -- ACTIVE | BENCHED | RETIRED | SUSPENDED | FREE_AGENT | LOANED
    current_franchise_id UUID,
    socials          JSONB,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now(),
    deleted_at       TIMESTAMPTZ,
    version          INT DEFAULT 0,
    UNIQUE(primary_game_id, ign)
);
CREATE INDEX idx_players_franchise ON players(current_franchise_id);
CREATE INDEX idx_players_state ON players(state);

CREATE TABLE player_roles (
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    role      VARCHAR(40) NOT NULL,
    PRIMARY KEY (player_id, role)
);

CREATE TABLE player_career (
    id           BIGSERIAL PRIMARY KEY,
    player_id    UUID NOT NULL REFERENCES players(id),
    franchise_id UUID NOT NULL,
    joined_at    DATE NOT NULL,
    left_at      DATE,
    role         VARCHAR(40),
    transfer_type VARCHAR(20)                     -- DRAFT/AUCTION/TRANSFER/LOAN/RELEASE
);

CREATE TABLE player_stats_aggregated (             -- projection from match.*
    player_id   UUID PRIMARY KEY REFERENCES players(id),
    season_id   UUID,
    matches     INT NOT NULL DEFAULT 0,
    wins        INT NOT NULL DEFAULT 0,
    kills       INT NOT NULL DEFAULT 0,
    deaths      INT NOT NULL DEFAULT 0,
    assists     INT NOT NULL DEFAULT 0,
    mvp_count   INT NOT NULL DEFAULT 0,
    rating      NUMERIC(6,3) NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE suspensions (
    id         BIGSERIAL PRIMARY KEY,
    player_id  UUID NOT NULL REFERENCES players(id),
    reason     TEXT NOT NULL,
    issued_by  UUID NOT NULL,
    starts_at  TIMESTAMPTZ NOT NULL,
    ends_at    TIMESTAMPTZ NOT NULL,
    appeal_state VARCHAR(20)
);
```

## 4. franchise-service

```sql
CREATE TABLE franchises (
    id             UUID PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    slug           CITEXT UNIQUE NOT NULL,
    owner_user_id  UUID NOT NULL,
    region         VARCHAR(20),
    logo_url       TEXT,
    founded_on     DATE,
    salary_cap     NUMERIC(14,2) NOT NULL DEFAULT 0,
    status         VARCHAR(20) DEFAULT 'ACTIVE',
    created_at     TIMESTAMPTZ DEFAULT now(),
    deleted_at     TIMESTAMPTZ,
    version        INT DEFAULT 0
);

CREATE TABLE rosters (
    id            UUID PRIMARY KEY,
    franchise_id  UUID NOT NULL REFERENCES franchises(id),
    game_id       SMALLINT NOT NULL,
    name          VARCHAR(80) NOT NULL,
    tier          VARCHAR(20) DEFAULT 'MAIN',     -- MAIN/ACADEMY/REGIONAL
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE roster_members (
    roster_id  UUID REFERENCES rosters(id) ON DELETE CASCADE,
    player_id  UUID NOT NULL,
    role       VARCHAR(40),
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (roster_id, player_id)
);

CREATE TABLE franchise_staff (
    franchise_id UUID REFERENCES franchises(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL,
    role         VARCHAR(40) NOT NULL,            -- OWNER/MANAGER/COACH/ANALYST
    PRIMARY KEY (franchise_id, user_id, role)
);

CREATE TABLE wallets (
    franchise_id UUID PRIMARY KEY REFERENCES franchises(id),
    balance      NUMERIC(14,2) NOT NULL DEFAULT 0,
    held         NUMERIC(14,2) NOT NULL DEFAULT 0,  -- escrowed for live bids
    currency     CHAR(3) NOT NULL DEFAULT 'USD',
    version      INT NOT NULL DEFAULT 0
);

CREATE TABLE wallet_ledger (
    id           BIGSERIAL PRIMARY KEY,
    franchise_id UUID NOT NULL,
    delta        NUMERIC(14,2) NOT NULL,
    kind         VARCHAR(30) NOT NULL,            -- AUCTION_HOLD / AUCTION_DEBIT / SPONSOR_CREDIT / SALARY_DEBIT
    reference_id UUID,
    metadata     JSONB,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sponsors (
    id           UUID PRIMARY KEY,
    franchise_id UUID NOT NULL REFERENCES franchises(id),
    name         VARCHAR(120) NOT NULL,
    amount       NUMERIC(14,2),
    starts_on    DATE,
    ends_on      DATE
);

CREATE TABLE trophies (
    id           BIGSERIAL PRIMARY KEY,
    franchise_id UUID NOT NULL REFERENCES franchises(id),
    tournament_id UUID NOT NULL,
    season_id    UUID,
    placement    SMALLINT NOT NULL                -- 1=champion
);
```

## 5. tournament-service

```sql
CREATE TABLE seasons (
    id        UUID PRIMARY KEY,
    name      VARCHAR(120) NOT NULL,
    game_id   SMALLINT NOT NULL,
    starts_on DATE,
    ends_on   DATE
);

CREATE TABLE tournaments (
    id            UUID PRIMARY KEY,
    season_id     UUID REFERENCES seasons(id),
    name          VARCHAR(160) NOT NULL,
    slug          CITEXT UNIQUE NOT NULL,
    game_id       SMALLINT NOT NULL,
    format        VARCHAR(30) NOT NULL,           -- SINGLE_ELIM / DOUBLE_ELIM / SWISS / ROUND_ROBIN / GROUP
    tier          VARCHAR(30),                    -- GRASSROOTS/UNIVERSITY/SEMI_PRO/PRO/INTL
    starts_at     TIMESTAMPTZ NOT NULL,
    ends_at       TIMESTAMPTZ NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    rules         JSONB,
    prize_pool    NUMERIC(14,2),
    created_at    TIMESTAMPTZ DEFAULT now(),
    version       INT DEFAULT 0
);

CREATE TABLE tournament_teams (
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    team_id       UUID NOT NULL,
    seed          INT,
    status        VARCHAR(20) DEFAULT 'CONFIRMED',
    PRIMARY KEY (tournament_id, team_id)
);

CREATE TABLE brackets (
    id             UUID PRIMARY KEY,
    tournament_id  UUID NOT NULL REFERENCES tournaments(id),
    kind           VARCHAR(20) NOT NULL,          -- UPPER/LOWER/GROUP
    structure      JSONB NOT NULL                  -- generated bracket tree
);

CREATE TABLE fixtures (
    id            UUID PRIMARY KEY,
    tournament_id UUID NOT NULL REFERENCES tournaments(id),
    bracket_id    UUID REFERENCES brackets(id),
    round         INT NOT NULL,
    team_a_id     UUID,
    team_b_id     UUID,
    scheduled_at  TIMESTAMPTZ,
    match_id      UUID,                           -- assigned when match scheduled
    status        VARCHAR(20) DEFAULT 'PENDING'
);
CREATE INDEX idx_fixtures_tournament_round ON fixtures(tournament_id, round);

CREATE TABLE standings (                          -- projection from match.completed
    tournament_id UUID,
    team_id       UUID,
    played        INT,
    wins          INT,
    losses        INT,
    points        INT,
    tiebreaker    NUMERIC(8,3),
    PRIMARY KEY (tournament_id, team_id)
);
```

## 6. match-service

```sql
CREATE TABLE matches (
    id            UUID PRIMARY KEY,
    tournament_id UUID,
    fixture_id    UUID,
    game_id       SMALLINT NOT NULL,
    team_a_id     UUID NOT NULL,
    team_b_id     UUID NOT NULL,
    scheduled_at  TIMESTAMPTZ NOT NULL,
    started_at    TIMESTAMPTZ,
    ended_at      TIMESTAMPTZ,
    status        VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    -- SCHEDULED/LIVE/COMPLETED/POSTPONED/FORFEIT/DISPUTED
    winner_team_id UUID,
    score         JSONB,                          -- {"a":2,"b":1,"maps":[...]}
    verified_by   UUID,
    created_at    TIMESTAMPTZ DEFAULT now()
) PARTITION BY RANGE (scheduled_at);

-- pg_partman maintains monthly partitions: matches_y2026m05, etc.

CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_matches_status_time ON matches(status, scheduled_at);

CREATE TABLE map_vetoes (
    match_id   UUID REFERENCES matches(id) ON DELETE CASCADE,
    step       INT,
    actor_team UUID,
    action     VARCHAR(10),                       -- BAN/PICK
    map_code   VARCHAR(30),
    PRIMARY KEY (match_id, step)
);

CREATE TABLE match_events (                        -- play-by-play
    id        BIGSERIAL,
    match_id  UUID NOT NULL,
    seq       INT NOT NULL,
    kind      VARCHAR(40) NOT NULL,
    payload   JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (match_id, seq)
) PARTITION BY HASH (match_id);

CREATE TABLE replays (
    id        UUID PRIMARY KEY,
    match_id  UUID NOT NULL,
    storage_url TEXT NOT NULL,
    bytes     BIGINT,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);
```

## 7. auction-service

```sql
CREATE TABLE auctions (
    id            UUID PRIMARY KEY,
    tournament_id UUID,
    season_id     UUID,
    name          VARCHAR(160) NOT NULL,
    status        VARCHAR(20) DEFAULT 'DRAFT',
    -- DRAFT/SCHEDULED/RUNNING/PAUSED/COMPLETED/CANCELED
    starts_at     TIMESTAMPTZ NOT NULL,
    rules         JSONB NOT NULL,                 -- {minBid, increment, antiSnipeSec, maxRounds...}
    current_round INT DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT now(),
    version       INT DEFAULT 0
);

CREATE TABLE auction_lots (
    id            UUID PRIMARY KEY,
    auction_id    UUID NOT NULL REFERENCES auctions(id),
    player_id     UUID NOT NULL,
    base_price    NUMERIC(14,2) NOT NULL,
    increment     NUMERIC(14,2) NOT NULL,
    pool          VARCHAR(20),                    -- A/B/C... or MARQUEE
    status        VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING/LIVE/SOLD/UNSOLD/RETAINED
    winning_franchise_id UUID,
    winning_price NUMERIC(14,2),
    ends_at       TIMESTAMPTZ,                    -- next deadline (timer-extended)
    version       INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_lots_auction_status ON auction_lots(auction_id, status);

CREATE TABLE bids (
    id            BIGSERIAL,
    lot_id        UUID NOT NULL,
    franchise_id  UUID NOT NULL,
    amount        NUMERIC(14,2) NOT NULL,
    bid_seq       BIGINT NOT NULL,                -- monotonically increasing per lot
    bidder_user_id UUID NOT NULL,
    idempotency_key UUID NOT NULL,
    placed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (lot_id, bid_seq)
) PARTITION BY HASH (lot_id);
CREATE UNIQUE INDEX uq_bids_idem ON bids(idempotency_key);

CREATE TABLE retentions (
    auction_id   UUID,
    franchise_id UUID,
    player_id    UUID,
    retention_price NUMERIC(14,2),
    PRIMARY KEY (auction_id, player_id)
);

CREATE TABLE auto_bids (                          -- proxy bids
    lot_id        UUID,
    franchise_id  UUID,
    max_amount    NUMERIC(14,2) NOT NULL,
    enabled       BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (lot_id, franchise_id)
);
```

## 8. ranking-service

```sql
CREATE TABLE rankings_snapshot (                  -- write-side; Redis ZSET is the read side
    id           BIGSERIAL PRIMARY KEY,
    scope        VARCHAR(30) NOT NULL,            -- GLOBAL/REGION/SEASON/MVP/FRANCHISE
    scope_key    VARCHAR(80) NOT NULL,
    subject_kind VARCHAR(20) NOT NULL,            -- PLAYER/FRANCHISE/TEAM
    subject_id   UUID NOT NULL,
    rating       NUMERIC(8,3) NOT NULL,
    rank         INT NOT NULL,
    snapshot_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ranksnap_scope ON rankings_snapshot(scope, scope_key, snapshot_at DESC);

CREATE TABLE elo_history (
    subject_id   UUID,
    occurred_at  TIMESTAMPTZ,
    rating_before NUMERIC(8,3),
    rating_after  NUMERIC(8,3),
    delta         NUMERIC(8,3),
    cause_kind   VARCHAR(30),
    cause_ref    UUID,
    PRIMARY KEY (subject_id, occurred_at)
);
```

## 9. notification-service

```sql
CREATE TABLE notifications (
    id          UUID PRIMARY KEY,
    user_id     UUID NOT NULL,
    kind        VARCHAR(40) NOT NULL,
    payload     JSONB NOT NULL,
    delivered   JSONB,                            -- {push:..., email:..., discord:...}
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);
CREATE INDEX idx_notif_user_unread ON notifications(user_id) WHERE read_at IS NULL;
```

## 10. community-service

```sql
CREATE TABLE posts (
    id        UUID PRIMARY KEY,
    author_id UUID NOT NULL,
    parent_id UUID,
    body      TEXT NOT NULL,
    tags      TEXT[],
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_tags ON posts USING gin (tags);

CREATE TABLE post_reactions (
    post_id UUID,
    user_id UUID,
    kind    VARCHAR(20) NOT NULL,                 -- LIKE/LOVE/...
    PRIMARY KEY (post_id, user_id, kind)
);

CREATE TABLE polls (
    id        UUID PRIMARY KEY,
    post_id   UUID REFERENCES posts(id),
    options   JSONB NOT NULL,
    closes_at TIMESTAMPTZ
);

CREATE TABLE fan_clubs (
    id           UUID PRIMARY KEY,
    franchise_id UUID NOT NULL,
    name         VARCHAR(120),
    created_at   TIMESTAMPTZ DEFAULT now()
);
```

## 11. media-service

```sql
CREATE TABLE media_assets (
    id          UUID PRIMARY KEY,
    owner_kind  VARCHAR(20),                     -- PLAYER/FRANCHISE/MATCH/TOURNAMENT
    owner_id    UUID,
    kind        VARCHAR(20),                     -- AVATAR/LOGO/REPLAY/BANNER
    storage_url TEXT NOT NULL,
    bytes       BIGINT,
    mime        VARCHAR(60),
    checksum    CHAR(64),
    uploaded_by UUID,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);
```

## 12. payment-service (PCI-isolated cluster)

```sql
CREATE TABLE payments (
    id              UUID PRIMARY KEY,
    payer_user_id   UUID NOT NULL,
    franchise_id    UUID,
    amount          NUMERIC(14,2) NOT NULL,
    currency        CHAR(3),
    kind            VARCHAR(30),                  -- WALLET_TOPUP/TOURNAMENT_FEE/...
    provider        VARCHAR(30),
    provider_ref    TEXT,
    status          VARCHAR(20),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE contracts (
    id            UUID PRIMARY KEY,
    franchise_id  UUID NOT NULL,
    player_id     UUID NOT NULL,
    starts_on     DATE NOT NULL,
    ends_on       DATE NOT NULL,
    salary_year   NUMERIC(14,2) NOT NULL,
    auction_lot_id UUID,
    status        VARCHAR(20) DEFAULT 'ACTIVE',
    signed_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_contracts_active ON contracts(player_id) WHERE status = 'ACTIVE';
```

---

## Partitioning summary

| Table              | Strategy          | Retention            |
|--------------------|-------------------|----------------------|
| auth_audit         | RANGE (month)     | 13 months hot, archive |
| matches            | RANGE (month)     | indefinite, archive cold > 24m |
| match_events       | HASH (match_id)   | 12m hot, S3 cold      |
| bids               | HASH (lot_id)     | indefinite            |
| notifications      | RANGE (month)     | 6m hot                |

## Audit log pattern

Each service ships an `xxx_audit` table written via JPA `@EntityListeners` or
a generic interceptor. Audit rows are also published to Kafka topic
`audit.events` for ELK ingestion. Audit rows are append-only; revoking access
to historical audit data is via column-level encryption (`pgcrypto`), not
DELETE.

## Indexing rules

- Every foreign key has an index.
- Every status column queried with `WHERE status = 'X'` has a partial index
  on the hot status (e.g. `WHERE status = 'LIVE'`).
- Full-text search columns use `pg_trgm` GIN indexes; large search workloads
  go to Elasticsearch via Kafka projection.

## Read replicas

- `player-service`, `ranking-service`, `community-service` all read from a
  follower for list/search endpoints (`@Transactional(readOnly = true)` →
  AbstractRoutingDataSource picks replica).
- Auction service does **not** use read replicas — every read of an auction
  lot or wallet must see the latest committed write.
