CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE games (
    id    SMALLSERIAL PRIMARY KEY,
    code  VARCHAR(20) UNIQUE NOT NULL,
    name  VARCHAR(80) NOT NULL,
    roles JSONB NOT NULL
);

CREATE TABLE players (
    id                   UUID PRIMARY KEY,
    user_id              UUID NOT NULL,
    ign                  VARCHAR(40) NOT NULL,
    real_name            VARCHAR(120),
    country_code         CHAR(2),
    primary_game_id      SMALLINT NOT NULL REFERENCES games(id),
    state                VARCHAR(20) NOT NULL DEFAULT 'FREE_AGENT',
    current_franchise_id UUID,
    socials              JSONB,
    created_at           TIMESTAMPTZ DEFAULT now(),
    updated_at           TIMESTAMPTZ DEFAULT now(),
    deleted_at           TIMESTAMPTZ,
    version              INT DEFAULT 0,
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
    id            BIGSERIAL PRIMARY KEY,
    player_id     UUID NOT NULL REFERENCES players(id),
    franchise_id  UUID NOT NULL,
    joined_at     DATE NOT NULL,
    left_at       DATE,
    role          VARCHAR(40),
    transfer_type VARCHAR(20)
);

CREATE TABLE player_stats_aggregated (
    player_id  UUID PRIMARY KEY REFERENCES players(id),
    season_id  UUID,
    matches    INT NOT NULL DEFAULT 0,
    wins       INT NOT NULL DEFAULT 0,
    kills      INT NOT NULL DEFAULT 0,
    deaths     INT NOT NULL DEFAULT 0,
    assists    INT NOT NULL DEFAULT 0,
    mvp_count  INT NOT NULL DEFAULT 0,
    rating     NUMERIC(6,3) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE suspensions (
    id           BIGSERIAL PRIMARY KEY,
    player_id    UUID NOT NULL REFERENCES players(id),
    reason       TEXT NOT NULL,
    issued_by    UUID NOT NULL,
    starts_at    TIMESTAMPTZ NOT NULL,
    ends_at      TIMESTAMPTZ NOT NULL,
    appeal_state VARCHAR(20)
);
