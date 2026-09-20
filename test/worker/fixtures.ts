/**
 * An in-memory stand-in for TMDB: a discover feed and the details behind it.
 * Tests describe films with a few fields and get the full shapes TMDB sends.
 */

import type { DiscoverMovie, DiscoverPage, DiscoverParams, MovieDetails, MovieParams, TmdbClient, Video } from '../../src/worker/tmdb.ts'

export interface FakeFilm {
  id: number
  title?: string
  originalTitle?: string
  originalLanguage?: string
  /** The regional (discover) date. */
  releaseDate: string
  /** The primary release date in the details; defaults to `releaseDate`. */
  primaryReleaseDate?: string
  overviewFr?: string
  overviewEn?: string
  videos?: Video[]
  /** Per country, the release types on file; every one dated `releaseDate`. */
  releaseTypes?: Record<string, number[]>
  /** Per country, explicit dated releases; overrides `releaseTypes`. */
  releaseEntries?: Record<string, { type: number; date: string }[]>
  genres?: { id: number; name: string }[]
}

export function discoverMovie(film: FakeFilm): DiscoverMovie {
  return {
    id: film.id,
    title: film.title ?? `Film ${film.id}`,
    original_title: film.originalTitle ?? film.title ?? `Film ${film.id}`,
    original_language: film.originalLanguage ?? 'fr',
    overview: film.overviewFr ?? '',
    genre_ids: (film.genres ?? []).map(genre => genre.id),
    poster_path: `/poster-${film.id}.jpg`,
    release_date: film.releaseDate,
    vote_average: 7.1,
    vote_count: 12,
    popularity: 10
  }
}

export function movieDetails(film: FakeFilm, language: string): MovieDetails {
  const overview = language.startsWith('fr') ? film.overviewFr ?? '' : film.overviewEn ?? ''
  const releaseTypes = film.releaseTypes ?? { FR: [3] }
  const releaseEntries =
    film.releaseEntries ??
    Object.fromEntries(Object.entries(releaseTypes).map(([country, types]) => [country, types.map(type => ({ type, date: film.releaseDate }))]))
  return {
    id: film.id,
    title: film.title ?? `Film ${film.id}`,
    original_title: film.originalTitle ?? film.title ?? `Film ${film.id}`,
    original_language: film.originalLanguage ?? 'fr',
    overview,
    genres: film.genres ?? [{ id: 18, name: 'Drame' }],
    runtime: 101,
    poster_path: `/poster-${film.id}.jpg`,
    release_date: film.primaryReleaseDate ?? film.releaseDate,
    vote_average: 7.1,
    vote_count: 12,
    videos: { results: film.videos ?? [] },
    release_dates: {
      results: Object.entries(releaseEntries).map(([country, entries]) => ({
        iso_3166_1: country,
        release_dates: entries.map(entry => ({ type: entry.type, release_date: `${entry.date}T00:00:00.000Z` }))
      }))
    }
  }
}

export interface FakeTmdb extends TmdbClient {
  calls: { discover: DiscoverParams[]; movie: { id: number; params: MovieParams }[] }
}

/** Serves `films` in pages of `pageSize`, ignoring the date window (tests pick the films). */
export function fakeTmdb(films: FakeFilm[], pageSize = 20): FakeTmdb {
  const calls: FakeTmdb['calls'] = { discover: [], movie: [] }
  return {
    calls,
    async discover(params): Promise<DiscoverPage> {
      calls.discover.push(params)
      const page = params.page ?? 1
      const results = films.slice((page - 1) * pageSize, page * pageSize).map(discoverMovie)
      return { page, total_pages: Math.max(1, Math.ceil(films.length / pageSize)), total_results: films.length, results }
    },
    async movie(id, params = {}) {
      calls.movie.push({ id, params })
      const film = films.find(entry => entry.id === id)
      if (!film) throw new Error(`TMDB returned 404 for /movie/${id}`)
      return movieDetails(film, params.language ?? 'fr-FR')
    }
  }
}

export function video(overrides: Partial<Video> & { key: string }): Video {
  return { site: 'YouTube', type: 'Trailer', iso_639_1: 'en', official: true, published_at: '2026-01-01T00:00:00.000Z', ...overrides }
}

/** Storage isolation is per test file, so each test starts by emptying the tables. */
export async function resetDb(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM entries'),
    db.prepare('DELETE FROM releases'),
    db.prepare('DELETE FROM movies'),
    db.prepare('DELETE FROM sync_runs'),
    db.prepare(`DELETE FROM sqlite_sequence WHERE name = 'sync_runs'`)
  ])
}
