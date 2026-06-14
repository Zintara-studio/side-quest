CREATE TABLE media_assets (
    id          UUID PRIMARY KEY,
    owner_kind  VARCHAR(20),
    owner_id    UUID,
    kind        VARCHAR(20),
    storage_url TEXT NOT NULL,
    bytes       BIGINT,
    mime        VARCHAR(60),
    checksum    CHAR(64),
    uploaded_by UUID,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_media_owner ON media_assets(owner_kind, owner_id);
