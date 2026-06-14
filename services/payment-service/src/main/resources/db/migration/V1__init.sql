CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE payments (
    id            UUID PRIMARY KEY,
    payer_user_id UUID NOT NULL,
    franchise_id  UUID,
    amount        NUMERIC(14,2) NOT NULL,
    currency      CHAR(3),
    kind          VARCHAR(30),
    provider      VARCHAR(30),
    provider_ref  TEXT,
    status        VARCHAR(20),
    created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_payments_user ON payments(payer_user_id, created_at DESC);

CREATE TABLE contracts (
    id             UUID PRIMARY KEY,
    franchise_id   UUID NOT NULL,
    player_id      UUID NOT NULL,
    starts_on      DATE NOT NULL,
    ends_on        DATE NOT NULL,
    salary_year    NUMERIC(14,2) NOT NULL,
    auction_lot_id UUID,
    status         VARCHAR(20) DEFAULT 'ACTIVE',
    signed_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_contracts_active ON contracts(player_id) WHERE status = 'ACTIVE';
