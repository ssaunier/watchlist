/**
 * Every SQL statement in one place. Write helpers return prepared statements
 * rather than running them, so a sync can bundle its writes into one
 * `db.batch()` (a single D1 round trip counts as one subrequest).
 */

export type Statement = D1PreparedStatement

export interface MovieRow {
  tmdb_id: number
  title: string
  original_title: string
  original_language: string
  overview: string | null
  genres: string
  runtime: number | null
  poster_path: string | null
  primary_release_date: string | null
  trailer_youtube_key: string | null
  tmdb_vote_average: number | null
  tmdb_vote_count: number | null
  tmdb_json: string
  fetched_at: string
}

export interface ReleaseRow {
  tmdb_id: number
  country: string
  release_date: string
  /** null keeps whatever type is already stored (a sync that only refreshes the date). */
  release_type: number | null
}

export type Status = 'new' | 'watchlist' | 'watched' | 'archived'
export const STATUSES: Status[] = ['new', 'watchlist', 'watched', 'archived']

export interface EntryRow {
  tmdb_id: number
  status: Status
  created_at: string
  updated_at: string
  added_at: string | null
  watched_at: string | null
  rating: number | null
  note: string | null
}

/** What the API hands the browser: a film, its release dates and the household's entry, camel-cased. */
export interface Movie {
  tmdbId: number
  title: string
  originalTitle: string
  originalLanguage: string
  overview: string | null
  genres: { id: number; name: string }[]
  runtime: number | null
  posterPath: string | null
  primaryReleaseDate: string | null
  trailerYoutubeKey: string | null
  voteAverage: number | null
  voteCount: number | null
  pressRating: number | null
  publicRating: number | null
  allocineId: number | null
  releases: { country: string; date: string; type: number }[]
  status: Status
  createdAt: string
  updatedAt: string
  addedAt: string | null
  watchedAt: string | null
  rating: number | null
  note: string | null
}

/** D1 binds at most 100 parameters per statement. */
const IN_CHUNK = 50

export async function knownMovieIds(db: D1Database, ids: number[]): Promise<Set<number>> {
  const known = new Set<number>()
  if (!ids.length) return known
  const statements: Statement[] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const chunk = ids.slice(i, i + IN_CHUNK)
    const marks = chunk.map(() => '?').join(',')
    statements.push(db.prepare(`SELECT tmdb_id FROM movies WHERE tmdb_id IN (${marks})`).bind(...chunk))
  }
  for (const result of await db.batch<{ tmdb_id: number }>(statements)) {
    for (const row of result.results) known.add(row.tmdb_id)
  }
  return known
}

export function upsertMovie(db: D1Database, row: MovieRow): Statement {
  return db
    .prepare(
      `INSERT INTO movies (tmdb_id, title, original_title, original_language, overview, genres, runtime, poster_path,
         primary_release_date, trailer_youtube_key, tmdb_vote_average, tmdb_vote_count, tmdb_json, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tmdb_id) DO UPDATE SET
         title = excluded.title, original_title = excluded.original_title, original_language = excluded.original_language,
         overview = excluded.overview, genres = excluded.genres, runtime = excluded.runtime, poster_path = excluded.poster_path,
         primary_release_date = excluded.primary_release_date, trailer_youtube_key = excluded.trailer_youtube_key,
         tmdb_vote_average = excluded.tmdb_vote_average, tmdb_vote_count = excluded.tmdb_vote_count,
         tmdb_json = excluded.tmdb_json, fetched_at = excluded.fetched_at`
    )
    .bind(
      row.tmdb_id, row.title, row.original_title, row.original_language, row.overview, row.genres, row.runtime, row.poster_path,
      row.primary_release_date, row.trailer_youtube_key, row.tmdb_vote_average, row.tmdb_vote_count, row.tmdb_json, row.fetched_at
    )
}

export function upsertRelease(db: D1Database, row: ReleaseRow): Statement {
  // A null type means "not looked up this time": keep the stored one, and
  // assume a theatrical release (3) for a row that does not exist yet.
  return db
    .prepare(
      `INSERT INTO releases (tmdb_id, country, release_date, release_type)
       VALUES (?, ?, ?, COALESCE(?, 3))
       ON CONFLICT(tmdb_id, country) DO UPDATE SET
         release_date = excluded.release_date,
         release_type = CASE WHEN ? IS NULL THEN releases.release_type ELSE excluded.release_type END`
    )
    .bind(row.tmdb_id, row.country, row.release_date, row.release_type, row.release_type)
}

/** Surfaces a film in New unless the household already has a say on it. */
export function ensureEntry(db: D1Database, tmdbId: number, now: string): Statement {
  return db
    .prepare(`INSERT OR IGNORE INTO entries (tmdb_id, status, created_at, updated_at) VALUES (?, 'new', ?, ?)`)
    .bind(tmdbId, now, now)
}

/** The films that reached a country's cinemas in a date range: what an Allociné week can match. */
export async function moviesReleasedBetween(db: D1Database, country: string, from: string, to: string): Promise<{ tmdb_id: number; title: string; original_title: string; release_date: string }[]> {
  const { results } = await db
    .prepare(`SELECT m.tmdb_id, m.title, m.original_title, r.release_date FROM movies m JOIN releases r ON r.tmdb_id = m.tmdb_id WHERE r.country = ? AND r.release_date BETWEEN ? AND ?`)
    .bind(country, from, to)
    .all<{ tmdb_id: number; title: string; original_title: string; release_date: string }>()
  return results
}

export interface RatingsRow {
  tmdb_id: number
  allocine_id: number
  press_rating: number | null
  public_rating: number | null
  ratings_fetched_at: string
}

export function updateRatings(db: D1Database, row: RatingsRow): Statement {
  return db
    .prepare(`UPDATE movies SET allocine_id = ?, press_rating = ?, public_rating = ?, ratings_fetched_at = ? WHERE tmdb_id = ?`)
    .bind(row.allocine_id, row.press_rating, row.public_rating, row.ratings_fetched_at, row.tmdb_id)
}

export function insertSyncRun(db: D1Database, run: { started_at: string; finished_at: string; country: string; stats: string }): Statement {
  return db
    .prepare(`INSERT INTO sync_runs (started_at, finished_at, country, stats) VALUES (?, ?, ?, ?)`)
    .bind(run.started_at, run.finished_at, run.country, run.stats)
}

const MOVIE_SELECT = `
  SELECT m.tmdb_id, m.title, m.original_title, m.original_language, m.overview, m.genres, m.runtime, m.poster_path,
         m.primary_release_date, m.trailer_youtube_key, m.tmdb_vote_average, m.tmdb_vote_count, m.press_rating, m.public_rating, m.allocine_id,
         e.status, e.created_at, e.updated_at, e.added_at, e.watched_at, e.rating, e.note,
         (SELECT json_group_array(json_object('country', r.country, 'date', r.release_date, 'type', r.release_type))
            FROM releases r WHERE r.tmdb_id = m.tmdb_id) AS releases
  FROM entries e JOIN movies m ON m.tmdb_id = e.tmdb_id`

type MovieQueryRow = Omit<MovieRow, 'tmdb_json' | 'fetched_at'> & EntryRow & { press_rating: number | null; public_rating: number | null; allocine_id: number | null; releases: string }

function toMovie(row: MovieQueryRow): Movie {
  return {
    tmdbId: row.tmdb_id,
    title: row.title,
    originalTitle: row.original_title,
    originalLanguage: row.original_language,
    overview: row.overview,
    genres: JSON.parse(row.genres || '[]'),
    runtime: row.runtime,
    posterPath: row.poster_path,
    primaryReleaseDate: row.primary_release_date,
    trailerYoutubeKey: row.trailer_youtube_key,
    voteAverage: row.tmdb_vote_average,
    voteCount: row.tmdb_vote_count,
    pressRating: row.press_rating,
    publicRating: row.public_rating,
    allocineId: row.allocine_id,
    releases: JSON.parse(row.releases || '[]'),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    addedAt: row.added_at,
    watchedAt: row.watched_at,
    rating: row.rating,
    note: row.note
  }
}

export async function listMovies(db: D1Database, status: Status): Promise<Movie[]> {
  const { results } = await db.prepare(`${MOVIE_SELECT} WHERE e.status = ? ORDER BY e.updated_at DESC`).bind(status).all<MovieQueryRow>()
  return results.map(toMovie)
}

export async function getMovie(db: D1Database, tmdbId: number): Promise<Movie | null> {
  const row = await db.prepare(`${MOVIE_SELECT} WHERE e.tmdb_id = ?`).bind(tmdbId).first<MovieQueryRow>()
  return row ? toMovie(row) : null
}

export async function countByStatus(db: D1Database): Promise<Record<Status, number>> {
  const counts: Record<Status, number> = { new: 0, watchlist: 0, watched: 0, archived: 0 }
  const { results } = await db.prepare(`SELECT status, COUNT(*) AS n FROM entries GROUP BY status`).all<{ status: Status; n: number }>()
  for (const row of results) counts[row.status] = row.n
  return counts
}

export interface EntryPatch {
  status?: Status
  added_at?: string | null
  watched_at?: string | null
  rating?: number | null
  note?: string | null
}

const PATCHABLE: (keyof EntryPatch)[] = ['status', 'added_at', 'watched_at', 'rating', 'note']

export async function updateEntry(db: D1Database, tmdbId: number, patch: EntryPatch, now: string): Promise<void> {
  const keys = PATCHABLE.filter(key => key in patch)
  const sets = keys.map(key => `${key} = ?`).concat('updated_at = ?')
  const values = keys.map(key => patch[key] ?? null).concat(now)
  await db.prepare(`UPDATE entries SET ${sets.join(', ')} WHERE tmdb_id = ?`).bind(...values, tmdbId).run()
}

export interface SyncRun {
  id: number
  started_at: string
  finished_at: string | null
  country: string
  stats: string | null
}

export async function lastSyncRun(db: D1Database): Promise<SyncRun | null> {
  return db.prepare(`SELECT * FROM sync_runs ORDER BY id DESC LIMIT 1`).first<SyncRun>()
}
