CREATE TABLE notifications (
    id         UUID NOT NULL,
    user_id    UUID NOT NULL,
    kind       VARCHAR(40) NOT NULL,
    payload    JSONB NOT NULL,
    delivered  JSONB,
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE notifications_default PARTITION OF notifications DEFAULT;

CREATE INDEX idx_notif_user_unread ON notifications(user_id, created_at) WHERE read_at IS NULL;
