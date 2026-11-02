-- A fourth list, Catch up: older films loaded once from a laptop
-- (scripts/backfill.ts), browsed like New but apart from the week's
-- releases. SQLite cannot change a CHECK constraint in place, so the table
-- is rebuilt; nothing references it.
CREATE TABLE entries_new (
  tmdb_id INTEGER PRIMARY KEY REFERENCES movies(tmdb_id),
  status TEXT NOT NULL CHECK (status IN ('new', 'catchup', 'watchlist', 'watched', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  added_at TEXT,
  watched_at TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 10),
  note TEXT
);
INSERT INTO entries_new SELECT tmdb_id, status, created_at, updated_at, added_at, watched_at, rating, note FROM entries;
DROP TABLE entries;
ALTER TABLE entries_new RENAME TO entries;
CREATE INDEX entries_status ON entries(status);
