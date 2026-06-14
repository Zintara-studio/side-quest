CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE seasons (
    id        UUID PRIMARY KEY,
    name      VARCHAR(120) NOT NULL,
    game_id   SMALLINT NOT NULL,
    starts_on DATE,
    ends_on   DATE
);

CREATE TABLE tournaments (
    id         UUID PRIMARY KEY,
    season_id  UUID REFERENCES seasons(id),
    name       VARCHAR(160) NOT NULL,
    slug       CITEXT UNIQUE NOT NULL,
    game_id    SMALLINT NOT NULL,
    format     VARCHAR(30) NOT NULL,
    tier       VARCHAR(30),
    starts_at  TIMESTAMPTZ NOT NULL,
    ends_at    TIMESTAMPTZ NOT NULL,
    status     VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    rules      JSONB,
    prize_pool NUMERIC(14,2),
    created_at TIMESTAMPTZ DEFAULT now(),
    version    INT DEFAULT 0
);

CREATE TABLE tournament_teams (
    tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
    team_id       UUID NOT NULL,
    seed          INT,
    status        VARCHAR(20) DEFAULT 'CONFIRMED',
    PRIMARY KEY (tournament_id, team_id)
);

CREATE TABLE brackets (
    id            UUID PRIMARY KEY,
    tournament_id UUID NOT NULL REFERENCES tournaments(id),
    kind          VARCHAR(20) NOT NULL,
    structure     JSONB NOT NULL
);

CREATE TABLE fixtures (
    id            UUID PRIMARY KEY,
    tournament_id UUID NOT NULL REFERENCES tournaments(id),
    bracket_id    UUID REFERENCES brackets(id),
    round         INT NOT NULL,
    team_a_id     UUID,
    team_b_id     UUID,
    scheduled_at  TIMESTAMPTZ,
    match_id      UUID,
    status        VARCHAR(20) DEFAULT 'PENDING'
);
CREATE INDEX idx_fixtures_tournament_round ON fixtures(tournament_id, round);

CREATE TABLE standings (
    tournament_id UUID,
    team_id       UUID,
    played        INT,
    wins          INT,
    losses        INT,
    points        INT,
    tiebreaker    NUMERIC(8,3),
    PRIMARY KEY (tournament_id, team_id)
);
