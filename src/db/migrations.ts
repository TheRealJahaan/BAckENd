/**
 * Append-only list of schema migrations. Never edit a migration that has shipped;
 * add a new entry instead. The array index + 1 is stored in PRAGMA user_version.
 */
export const migrations: readonly string[] = [
  `
  CREATE TABLE users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE links (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug        TEXT NOT NULL UNIQUE,
    target_url  TEXT NOT NULL,
    title       TEXT,
    click_count INTEGER NOT NULL DEFAULT 0,
    expires_at  TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX idx_links_user_created ON links(user_id, created_at DESC);

  CREATE TABLE clicks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id      TEXT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    clicked_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    referrer     TEXT,
    user_agent   TEXT,
    visitor_hash TEXT
  );
  CREATE INDEX idx_clicks_link_time ON clicks(link_id, clicked_at);
  `,
];
