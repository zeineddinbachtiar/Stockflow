-- StockFlow: authentication session persistence
-- PostgreSQL 18

BEGIN;

CREATE TABLE auth_sessions (
    id                  UUID PRIMARY KEY,
    user_id             BIGINT NOT NULL
                            REFERENCES users (id)
                            ON DELETE CASCADE,
    refresh_token_hash  CHAR(64) NOT NULL UNIQUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_refreshed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ NOT NULL,
    revoked_at          TIMESTAMPTZ,

    CONSTRAINT chk_auth_sessions_expiry
        CHECK (expires_at > created_at),

    CONSTRAINT chk_auth_sessions_revoked
        CHECK (
            revoked_at IS NULL
            OR revoked_at >= created_at
        )
);

CREATE INDEX idx_auth_sessions_user_active
    ON auth_sessions (user_id)
    WHERE revoked_at IS NULL;

CREATE INDEX idx_auth_sessions_expires_at
    ON auth_sessions (expires_at)
    WHERE revoked_at IS NULL;

INSERT INTO schema_migrations (version, description)
VALUES (
    '002',
    'Add persistent authentication sessions and refresh token storage'
);

COMMIT;