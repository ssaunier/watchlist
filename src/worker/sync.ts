/**
 * Pulls what reached cinemas recently into D1 and surfaces the newcomers in
 * "New". Runs hourly and does a little each time: the free plan caps one
 * invocation at 50 subrequests (TMDB calls and D1 queries alike) and 10 ms
 * of CPU, so a run fetches details for a few films and leaves the rest for
 * the next hour. Everything is an upsert, so running it twice is harmless.
 */

import type { DiscoverMovie, MovieDetails, TmdbClient, Video } from './tmdb.ts'
import { knownMovieIds, upsertMovie, upsertRelease, ensureEntry, insertSyncRun, type MovieRow, type Statement } from './db.ts'

/** How far back the feed looks: TMDB sometimes files a small film weeks after its Wednesday. */
const LOOKBACK_DAYS = 28
/** And a little ahead, so next week's films are ready to browse on release day. */
const LOOKAHEAD_DAYS = 7
/** Discover pages hold 20 films; five weeks of French releases run to about 110. */
const MAX_DISCOVER_PAGES = 10

export interface SyncConfig {
  maxAgeYears: number
  detailsPerRun: number
}

export interface SyncStats {
  seen: number
  fetched: number
  added: number
  reReleases: number
  pending: number
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

/**
 * A film first released years before it reached this country's cinemas is a
 * re-release (an anniversary run, a restored classic), not a new film. A
 * festival film that took a year to find a French distributor is not.
 */
export function isReRelease(primaryReleaseDate: string | undefined, regionalDate: string, maxAgeYears: number): boolean {
  if (!primaryReleaseDate) return false
  const primary = new Date(primaryReleaseDate)
  const regional = new Date(regionalDate)
  if (Number.isNaN(primary.getTime()) || Number.isNaN(regional.getTime())) return false
  const limit = new Date(regional)
  limit.setUTCFullYear(limit.getUTCFullYear() - maxAgeYears)
  return primary < limit
}

/**
 * The YouTube key of the trailer to link. Original version first: the app
 * always shows films in their own language. Then English, then whatever is
 * left; a teaser only when there is no trailer at all.
 */
export function pickTrailer(videos: Video[] | undefined, originalLanguage: string): string | null {
  if (!videos?.length) return null
  const youtube = videos.filter(video => video.site === 'YouTube' && video.key)
  const rank = (video: Video) => {
    let score = 0
    if (video.type === 'Trailer') score += 100
    else if (video.type === 'Teaser') score += 50
    else return -1
    if (video.iso_639_1 === originalLanguage) score += 20
    else if (video.iso_639_1 === 'en') score += 10
    if (video.official) score += 5
    return score
  }
  const best = youtube
    .map(video => ({ video, score: rank(video) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score || String(b.video.published_at).localeCompare(String(a.video.published_at)))[0]
  return best ? best.video.key : null
}

export interface Window {
  from: string
  to: string
}

export interface Release {
  date: string
  type: number
}

/** TMDB release types: 3 is a theatrical release, 2 a limited one. */
const THEATRICAL = [3, 2]

/**
 * Which cinema release brought the film into the feed. The feed only reports
 * a film's first date of the asked types, so a classic back in cinemas comes
 * with its previous run's date; the film's own list of dates has the run
 * that actually falls in the window. Wide releases win over limited ones,
 * and the feed's date stands when the list has nothing in the window.
 */
export function pickRelease(details: MovieDetails, country: string, feedDate: string, window: Window): Release {
  const dates = (details.release_dates?.results.find(entry => entry.iso_3166_1 === country)?.release_dates ?? [])
    .filter(entry => THEATRICAL.includes(entry.type))
    .map(entry => ({ date: entry.release_date.slice(0, 10), type: entry.type }))
    .sort((a, b) => a.date.localeCompare(b.date))
  for (const type of THEATRICAL) {
    const inWindow = dates.find(entry => entry.type === type && entry.date >= window.from && entry.date <= window.to)
    if (inWindow) return inWindow
  }
  const type = THEATRICAL.find(candidate => dates.some(entry => entry.type === candidate)) ?? 3
  return { date: feedDate, type }
}

/** The stored snapshot: the details minus the bulky sub-resources already distilled into columns. */
function snapshot(details: MovieDetails): string {
  const { videos, release_dates, ...rest } = details
  return JSON.stringify(rest)
}

export function movieRowFrom(details: MovieDetails, overview: string, now: string): MovieRow {
  return {
    tmdb_id: details.id,
    title: details.title || details.original_title,
    original_title: details.original_title,
    original_language: details.original_language,
    overview: overview || null,
    genres: JSON.stringify(details.genres ?? []),
    runtime: details.runtime ?? null,
    poster_path: details.poster_path ?? null,
    primary_release_date: details.release_date || null,
    trailer_youtube_key: pickTrailer(details.videos?.results, details.original_language),
    tmdb_vote_average: details.vote_average ?? null,
    tmdb_vote_count: details.vote_count ?? null,
    tmdb_json: snapshot(details),
    fetched_at: now
  }
}

export function syncWindow(today: Date): Window {
  return { from: isoDate(addDays(today, -LOOKBACK_DAYS)), to: isoDate(addDays(today, LOOKAHEAD_DAYS)) }
}

async function discoverWindow(tmdb: TmdbClient, country: string, { from, to }: Window): Promise<DiscoverMovie[]> {
  const seen = new Map<number, DiscoverMovie>()
  for (let page = 1; page <= MAX_DISCOVER_PAGES; page++) {
    const result = await tmdb.discover({ region: country, from, to, page })
    for (const movie of result.results) if (!seen.has(movie.id)) seen.set(movie.id, movie)
    if (page >= result.total_pages) break
  }
  return [...seen.values()]
}

export async function syncCountry(db: D1Database, tmdb: TmdbClient, country: string, config: SyncConfig, today = new Date()): Promise<SyncStats> {
  const startedAt = new Date().toISOString()
  const now = startedAt
  const window = syncWindow(today)
  const feed = await discoverWindow(tmdb, country, window)
  const known = await knownMovieIds(db, feed.map(movie => movie.id))

  const statements: Statement[] = []
  const stats: SyncStats = { seen: feed.length, fetched: 0, added: 0, reReleases: 0, pending: 0 }

  // Films already in the database only need their release row kept current:
  // a postponed film's date moves and the row follows. A feed date outside
  // the window is an earlier run of the same film (see pickRelease) and is
  // left alone.
  for (const movie of feed) {
    if (!known.has(movie.id)) continue
    if (movie.release_date < window.from || movie.release_date > window.to) continue
    statements.push(upsertRelease(db, { tmdb_id: movie.id, country, release_date: movie.release_date, release_type: null }))
  }

  const unknown = feed.filter(movie => !known.has(movie.id))
  const batch = unknown.slice(0, config.detailsPerRun)
  stats.pending = unknown.length - batch.length

  for (const movie of batch) {
    const details = await tmdb.movie(movie.id, { originalLanguage: movie.original_language })
    stats.fetched++

    // TMDB does not fall back between languages: a film with no French
    // synopsis yet comes back with an empty overview, so ask for English.
    let overview = details.overview
    if (!overview) overview = (await tmdb.movie(movie.id, { language: 'en-US', originalLanguage: movie.original_language })).overview

    const release = pickRelease(details, country, movie.release_date, window)
    const reRelease = isReRelease(details.release_date, release.date, config.maxAgeYears)
    statements.push(upsertMovie(db, movieRowFrom(details, overview, now)))
    statements.push(upsertRelease(db, { tmdb_id: movie.id, country, release_date: release.date, release_type: release.type }))
    // A re-release is stored (so it is not fetched again next hour) but never
    // offered for review: the household is looking for new films.
    if (reRelease) stats.reReleases++
    else {
      statements.push(ensureEntry(db, movie.id, now))
      stats.added++
    }
  }

  if (statements.length) await db.batch(statements)
  await insertSyncRun(db, { started_at: startedAt, finished_at: new Date().toISOString(), country, stats: JSON.stringify(stats) }).run()
  return stats
}

export function parseCountries(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map(code => code.trim().toUpperCase())
    .filter(code => /^[A-Z]{2}$/.test(code))
}

export async function syncAll(db: D1Database, tmdb: TmdbClient, env: { RELEASE_COUNTRIES?: string; MAX_AGE_YEARS?: string; DETAILS_PER_RUN?: string }, today = new Date()): Promise<Record<string, SyncStats>> {
  const config: SyncConfig = {
    maxAgeYears: Number(env.MAX_AGE_YEARS) || 3,
    detailsPerRun: Number(env.DETAILS_PER_RUN) || 10
  }
  const results: Record<string, SyncStats> = {}
  for (const country of parseCountries(env.RELEASE_COUNTRIES)) {
    results[country] = await syncCountry(db, tmdb, country, config, today)
  }
  return results
}
