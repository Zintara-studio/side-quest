CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE posts (
    id         UUID PRIMARY KEY,
    author_id  UUID NOT NULL,
    parent_id  UUID,
    body       TEXT NOT NULL,
    tags       TEXT[],
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_tags ON posts USING gin (tags);

CREATE TABLE post_reactions (
    post_id UUID,
    user_id UUID,
    kind    VARCHAR(20) NOT NULL,
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
