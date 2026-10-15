-- Party Quest sync store (Cloudflare D1 / SQLite). Safe to re-run.
--
-- No accounts: each person is identified by a secret code that lives on their
-- phone. The server only ever stores a SHA-256 hash of it (`owner`).

CREATE TABLE IF NOT EXISTS owners (
  owner      TEXT PRIMARY KEY,          -- sha256 hex of the normalized secret code
  name       TEXT NOT NULL DEFAULT '',  -- adventurer name at sign-up (fallback for the Party view)
  created_at INTEGER NOT NULL           -- ms since epoch
);

-- One row per synced record: a profile, a character, or a completed session.
-- `data` is the app's own JSON for that record; `updated_at` drives
-- last-write-wins between devices.
CREATE TABLE IF NOT EXISTS records (
  kind       TEXT NOT NULL,             -- 'profiles' | 'characters' | 'sessions'
  id         TEXT NOT NULL,
  owner      TEXT NOT NULL,
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (kind, id)
);

CREATE INDEX IF NOT EXISTS idx_records_owner ON records (owner, kind);
