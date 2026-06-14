CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT UNIQUE NOT NULL,
    password_hash   TEXT,
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
    provider     VARCHAR(20) NOT NULL,
    provider_uid VARCHAR(255) NOT NULL,
    UNIQUE(provider, provider_uid)
);

CREATE TABLE roles (
    id   SMALLSERIAL PRIMARY KEY,
    name VARCHAR(40) UNIQUE NOT NULL
);

CREATE TABLE account_roles (
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    role_id    SMALLINT NOT NULL REFERENCES roles(id),
    scope      VARCHAR(40),
    PRIMARY KEY (account_id, role_id, COALESCE(scope, ''))
);

CREATE TABLE sessions (
    id                 UUID PRIMARY KEY,
    account_id         UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    device_fingerprint TEXT,
    ip                 INET,
    user_agent         TEXT,
    issued_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at         TIMESTAMPTZ NOT NULL,
    revoked_at         TIMESTAMPTZ,
    rotated_from       UUID REFERENCES sessions(id)
);
CREATE INDEX idx_sessions_account ON sessions(account_id) WHERE revoked_at IS NULL;

CREATE TABLE token_blacklist (
    jti        UUID PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE auth_audit (
    id          BIGSERIAL,
    account_id  UUID,
    event_type  VARCHAR(40) NOT NULL,
    ip          INET,
    metadata    JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE auth_audit_default PARTITION OF auth_audit DEFAULT;

INSERT INTO roles(name) VALUES
    ('SUPER_ADMIN'),('ADMIN'),('FRANCHISE_OWNER'),('MANAGER'),
    ('COACH'),('ANALYST'),('PLAYER'),('REFEREE'),('FAN')
ON CONFLICT DO NOTHING;
