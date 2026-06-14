CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE franchises (
    id            UUID PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    slug          CITEXT UNIQUE NOT NULL,
    owner_user_id UUID NOT NULL,
    region        VARCHAR(20),
    logo_url      TEXT,
    founded_on    DATE,
    salary_cap    NUMERIC(14,2) NOT NULL DEFAULT 0,
    status        VARCHAR(20) DEFAULT 'ACTIVE',
    created_at    TIMESTAMPTZ DEFAULT now(),
    deleted_at    TIMESTAMPTZ,
    version       INT DEFAULT 0
);

CREATE TABLE rosters (
    id           UUID PRIMARY KEY,
    franchise_id UUID NOT NULL REFERENCES franchises(id),
    game_id      SMALLINT NOT NULL,
    name         VARCHAR(80) NOT NULL,
    tier         VARCHAR(20) DEFAULT 'MAIN',
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_rosters_franchise ON rosters(franchise_id);

CREATE TABLE roster_members (
    roster_id UUID REFERENCES rosters(id) ON DELETE CASCADE,
    player_id UUID NOT NULL,
    role      VARCHAR(40),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (roster_id, player_id)
);

CREATE TABLE franchise_staff (
    franchise_id UUID REFERENCES franchises(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL,
    role         VARCHAR(40) NOT NULL,
    PRIMARY KEY (franchise_id, user_id, role)
);

CREATE TABLE wallets (
    franchise_id UUID PRIMARY KEY REFERENCES franchises(id),
    balance      NUMERIC(14,2) NOT NULL DEFAULT 0,
    held         NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency     CHAR(3) NOT NULL DEFAULT 'USD',
    version      INT NOT NULL DEFAULT 0
);

CREATE TABLE wallet_ledger (
    id           BIGSERIAL PRIMARY KEY,
    franchise_id UUID NOT NULL,
    delta        NUMERIC(14,2) NOT NULL,
    kind         VARCHAR(30) NOT NULL,
    reference_id UUID,
    metadata     JSONB,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_franchise ON wallet_ledger(franchise_id, occurred_at DESC);

CREATE TABLE sponsors (
    id           UUID PRIMARY KEY,
    franchise_id UUID NOT NULL REFERENCES franchises(id),
    name         VARCHAR(120) NOT NULL,
    amount       NUMERIC(14,2),
    starts_on    DATE,
    ends_on      DATE
);

CREATE TABLE trophies (
    id            BIGSERIAL PRIMARY KEY,
    franchise_id  UUID NOT NULL REFERENCES franchises(id),
    tournament_id UUID NOT NULL,
    season_id     UUID,
    placement     SMALLINT NOT NULL
);
