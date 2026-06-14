CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE users (
    id            UUID PRIMARY KEY,
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
