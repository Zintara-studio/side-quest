CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE matches (
    id             UUID NOT NULL,
    tournament_id  UUID,
    fixture_id     UUID,
    game_id        SMALLINT NOT NULL,
    team_a_id      UUID NOT NULL,
    team_b_id      UUID NOT NULL,
    scheduled_at   TIMESTAMPTZ NOT NULL,
    started_at     TIMESTAMPTZ,
    ended_at       TIMESTAMPTZ,
    status         VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    winner_team_id UUID,
    score          JSONB,
    verified_by    UUID,
    created_at     TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id, scheduled_at)
) PARTITION BY RANGE (scheduled_at);

CREATE TABLE matches_default PARTITION OF matches DEFAULT;

CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_matches_status_time ON matches(status, scheduled_at);

CREATE TABLE map_vetoes (
    match_id   UUID NOT NULL,
    step       INT,
    actor_team UUID,
    action     VARCHAR(10),
    map_code   VARCHAR(30),
    PRIMARY KEY (match_id, step)
);

CREATE TABLE match_events (
    id          BIGSERIAL,
    match_id    UUID NOT NULL,
    seq         INT NOT NULL,
    kind        VARCHAR(40) NOT NULL,
    payload     JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (match_id, seq)
) PARTITION BY HASH (match_id);

CREATE TABLE match_events_p0 PARTITION OF match_events FOR VALUES WITH (modulus 4, remainder 0);
CREATE TABLE match_events_p1 PARTITION OF match_events FOR VALUES WITH (modulus 4, remainder 1);
CREATE TABLE match_events_p2 PARTITION OF match_events FOR VALUES WITH (modulus 4, remainder 2);
CREATE TABLE match_events_p3 PARTITION OF match_events FOR VALUES WITH (modulus 4, remainder 3);

CREATE TABLE replays (
    id          UUID PRIMARY KEY,
    match_id    UUID NOT NULL,
    storage_url TEXT NOT NULL,
    bytes       BIGINT,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);
