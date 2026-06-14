CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE auctions (
    id            UUID PRIMARY KEY,
    tournament_id UUID,
    season_id     UUID,
    name          VARCHAR(160) NOT NULL,
    status        VARCHAR(20) DEFAULT 'DRAFT',
    starts_at     TIMESTAMPTZ NOT NULL,
    rules         JSONB NOT NULL,
    current_round INT DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT now(),
    version       INT DEFAULT 0
);

CREATE TABLE auction_lots (
    id                   UUID PRIMARY KEY,
    auction_id           UUID NOT NULL REFERENCES auctions(id),
    player_id            UUID NOT NULL,
    base_price           NUMERIC(14,2) NOT NULL,
    increment            NUMERIC(14,2) NOT NULL,
    pool                 VARCHAR(20),
    status               VARCHAR(20) DEFAULT 'PENDING',
    winning_franchise_id UUID,
    winning_price        NUMERIC(14,2),
    ends_at              TIMESTAMPTZ,
    version              INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_lots_auction_status ON auction_lots(auction_id, status);
CREATE INDEX idx_lots_live ON auction_lots(auction_id) WHERE status = 'LIVE';

CREATE TABLE bids (
    id              BIGSERIAL,
    lot_id          UUID NOT NULL,
    franchise_id    UUID NOT NULL,
    amount          NUMERIC(14,2) NOT NULL,
    bid_seq         BIGINT NOT NULL,
    bidder_user_id  UUID NOT NULL,
    idempotency_key UUID NOT NULL,
    placed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (lot_id, bid_seq)
) PARTITION BY HASH (lot_id);

CREATE TABLE bids_p0 PARTITION OF bids FOR VALUES WITH (modulus 8, remainder 0);
CREATE TABLE bids_p1 PARTITION OF bids FOR VALUES WITH (modulus 8, remainder 1);
CREATE TABLE bids_p2 PARTITION OF bids FOR VALUES WITH (modulus 8, remainder 2);
CREATE TABLE bids_p3 PARTITION OF bids FOR VALUES WITH (modulus 8, remainder 3);
CREATE TABLE bids_p4 PARTITION OF bids FOR VALUES WITH (modulus 8, remainder 4);
CREATE TABLE bids_p5 PARTITION OF bids FOR VALUES WITH (modulus 8, remainder 5);
CREATE TABLE bids_p6 PARTITION OF bids FOR VALUES WITH (modulus 8, remainder 6);
CREATE TABLE bids_p7 PARTITION OF bids FOR VALUES WITH (modulus 8, remainder 7);

CREATE UNIQUE INDEX uq_bids_idem ON bids(idempotency_key);

CREATE TABLE retentions (
    auction_id      UUID,
    franchise_id    UUID,
    player_id       UUID,
    retention_price NUMERIC(14,2),
    PRIMARY KEY (auction_id, player_id)
);

CREATE TABLE auto_bids (
    lot_id       UUID,
    franchise_id UUID,
    max_amount   NUMERIC(14,2) NOT NULL,
    enabled      BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (lot_id, franchise_id)
);
