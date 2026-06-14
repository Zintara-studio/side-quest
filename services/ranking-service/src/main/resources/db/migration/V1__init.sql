CREATE TABLE rankings_snapshot (
    id           BIGSERIAL PRIMARY KEY,
    scope        VARCHAR(30) NOT NULL,
    scope_key    VARCHAR(80) NOT NULL,
    subject_kind VARCHAR(20) NOT NULL,
    subject_id   UUID NOT NULL,
    rating       NUMERIC(8,3) NOT NULL,
    rank         INT NOT NULL,
    snapshot_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ranksnap_scope ON rankings_snapshot(scope, scope_key, snapshot_at DESC);

CREATE TABLE elo_history (
    subject_id    UUID,
    occurred_at   TIMESTAMPTZ,
    rating_before NUMERIC(8,3),
    rating_after  NUMERIC(8,3),
    delta         NUMERIC(8,3),
    cause_kind    VARCHAR(30),
    cause_ref     UUID,
    PRIMARY KEY (subject_id, occurred_at)
);
