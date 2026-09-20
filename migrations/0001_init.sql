-- Films, one row per TMDB movie. Everything here is a snapshot of TMDB and
-- can be refreshed; nothing the household decides lives in this table.
CREATE TABLE movies (
  tmdb_id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  original_title TEXT NOT NULL,
  original_language TEXT NOT NULL,
  overview TEXT,
  genres TEXT NOT NULL DEFAULT '[]',
  runtime INTEGER,
  poster_path TEXT,
  primary_release_date TEXT,
  trailer_youtube_key TEXT,
  tmdb_vote_average REAL,
  tmdb_vote_count INTEGER,
  press_rating REAL,
  public_rating REAL,
  tmdb_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

-- When a film reached cinemas in each monitored country. A film released in
-- France and later in Korea has two rows.
CREATE TABLE releases (
  tmdb_id INTEGER NOT NULL REFERENCES movies(tmdb_id),
  country TEXT NOT NULL,
  release_date TEXT NOT NULL,
  release_type INTEGER NOT NULL,
  PRIMARY KEY (tmdb_id, country)
);

-- The household's own state, one row per film the sync has surfaced.
CREATE TABLE entries (
  tmdb_id INTEGER PRIMARY KEY REFERENCES movies(tmdb_id),
  status TEXT NOT NULL CHECK (status IN ('new', 'watchlist', 'watched', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  added_at TEXT,
  watched_at TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 10),
  note TEXT
);
CREATE INDEX entries_status ON entries(status);

-- One row per sync run, for the footer and for debugging.
CREATE TABLE sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  country TEXT NOT NULL,
  stats TEXT
);
