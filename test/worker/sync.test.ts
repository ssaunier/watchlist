import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { isReRelease, pickTrailer, pickRelease, parseCountries, syncCountry, syncWindow, movieRowFrom, type SyncConfig } from '../../src/worker/sync.ts'
import { countByStatus, listMovies } from '../../src/worker/db.ts'
import { fakeTmdb, movieDetails, resetDb, video, type FakeFilm } from './fixtures.ts'

const config: SyncConfig = { maxAgeYears: 3, detailsPerRun: 10 }
const today = new Date('2026-09-20T10:00:00Z')

beforeEach(() => resetDb(env.DB))

describe('isReRelease', () => {
  it('flags a classic back in cinemas years later', () => {
    expect(isReRelease('2019-04-24', '2026-09-16', 3)).toBe(true)
  })

  it('keeps a festival film that took a year to reach cinemas', () => {
    expect(isReRelease('2025-05-20', '2026-09-16', 3)).toBe(false)
  })

  it('keeps a film with no primary date', () => {
    expect(isReRelease(undefined, '2026-09-16', 3)).toBe(false)
    expect(isReRelease('', '2026-09-16', 3)).toBe(false)
  })
})

describe('pickTrailer', () => {
  it('prefers the original-version trailer over the English one', () => {
    const videos = [video({ key: 'en', iso_639_1: 'en' }), video({ key: 'ko', iso_639_1: 'ko' })]
    expect(pickTrailer(videos, 'ko')).toBe('ko')
  })

  it('falls back to English, then to any trailer', () => {
    expect(pickTrailer([video({ key: 'de', iso_639_1: 'de' }), video({ key: 'en', iso_639_1: 'en' })], 'ko')).toBe('en')
    expect(pickTrailer([video({ key: 'de', iso_639_1: 'de' })], 'ko')).toBe('de')
  })

  it('takes a teaser only when there is no trailer, and ignores other sites and clips', () => {
    expect(pickTrailer([video({ key: 'teaser', type: 'Teaser' }), video({ key: 'clip', type: 'Clip' })], 'fr')).toBe('teaser')
    expect(pickTrailer([video({ key: 'vimeo', site: 'Vimeo' })], 'fr')).toBeNull()
    expect(pickTrailer([], 'fr')).toBeNull()
    expect(pickTrailer(undefined, 'fr')).toBeNull()
  })

  it('prefers the official, then the most recent, among equals', () => {
    const videos = [
      video({ key: 'old', published_at: '2025-01-01T00:00:00.000Z' }),
      video({ key: 'new', published_at: '2026-01-01T00:00:00.000Z' }),
      video({ key: 'fan', official: false, published_at: '2026-06-01T00:00:00.000Z' })
    ]
    expect(pickTrailer(videos, 'en')).toBe('new')
  })
})

describe('pickRelease', () => {
  const window = syncWindow(today)
  const details = (releaseEntries: Record<string, { type: number; date: string }[]>) => movieDetails({ id: 1, releaseDate: '2026-09-16', releaseEntries }, 'fr-FR')

  it('takes the run that falls in the window rather than the feed’s first date', () => {
    const classic = details({ FR: [{ type: 3, date: '2024-03-06' }, { type: 3, date: '2026-09-03' }] })
    expect(pickRelease(classic, 'FR', '2024-03-06', window)).toEqual({ date: '2026-09-03', type: 3 })
  })

  it('prefers a wide release to a limited one in the same window', () => {
    const both = details({ FR: [{ type: 2, date: '2026-09-09' }, { type: 3, date: '2026-09-16' }] })
    expect(pickRelease(both, 'FR', '2026-09-16', window)).toEqual({ date: '2026-09-16', type: 3 })
    const limited = details({ FR: [{ type: 2, date: '2026-09-09' }] })
    expect(pickRelease(limited, 'FR', '2026-09-09', window)).toEqual({ date: '2026-09-09', type: 2 })
  })

  it('keeps the feed’s date when the film lists nothing in the window, with the best type on file', () => {
    expect(pickRelease(details({ FR: [{ type: 3, date: '2020-01-01' }] }), 'FR', '2026-09-16', window)).toEqual({ date: '2026-09-16', type: 3 })
    expect(pickRelease(details({ FR: [{ type: 2, date: '2020-01-01' }] }), 'FR', '2026-09-16', window)).toEqual({ date: '2026-09-16', type: 2 })
    expect(pickRelease(details({ US: [{ type: 3, date: '2026-09-16' }] }), 'FR', '2026-09-16', window)).toEqual({ date: '2026-09-16', type: 3 })
    expect(pickRelease(details({ FR: [{ type: 4, date: '2026-09-16' }] }), 'FR', '2026-09-16', window)).toEqual({ date: '2026-09-16', type: 3 })
  })
})

describe('parseCountries', () => {
  it('accepts a comma-separated list, whatever the case and spacing', () => {
    expect(parseCountries('FR')).toEqual(['FR'])
    expect(parseCountries(' fr, KR ,us')).toEqual(['FR', 'KR', 'US'])
    expect(parseCountries('')).toEqual([])
    expect(parseCountries(undefined)).toEqual([])
    expect(parseCountries('France')).toEqual([])
  })
})

describe('movieRowFrom', () => {
  it('keeps the snapshot free of the sub-resources distilled into columns', () => {
    const details = movieDetails({ id: 7, releaseDate: '2026-09-16', videos: [video({ key: 'abc' })] }, 'fr-FR')
    const row = movieRowFrom(details, 'Synopsis', '2026-09-20T10:00:00.000Z')
    expect(row.trailer_youtube_key).toBe('abc')
    expect(row.overview).toBe('Synopsis')
    expect(JSON.parse(row.tmdb_json)).not.toHaveProperty('videos')
    expect(JSON.parse(row.tmdb_json)).not.toHaveProperty('release_dates')
    expect(JSON.parse(row.tmdb_json).id).toBe(7)
  })

  it('falls back to the original title and stores an empty overview as null', () => {
    const details = movieDetails({ id: 8, releaseDate: '2026-09-16', title: '', originalTitle: 'Original' }, 'fr-FR')
    const row = movieRowFrom(details, '', 'now')
    expect(row.title).toBe('Original')
    expect(row.overview).toBeNull()
  })
})

describe('syncCountry', () => {
  const week: FakeFilm[] = [
    { id: 1, title: 'Resident Evil', originalLanguage: 'en', releaseDate: '2026-09-16', overviewFr: 'Un virus.', videos: [video({ key: 'ev1' })] },
    { id: 2, title: 'Les Contrebandiers', releaseDate: '2026-09-16', overviewFr: 'Des contrebandiers.' },
    { id: 3, title: 'Sham', originalLanguage: 'ko', releaseDate: '2026-09-16', overviewFr: '', overviewEn: 'Only in English so far.' }
  ]

  it('surfaces this week’s films in New, with their release and trailer', async () => {
    const tmdb = fakeTmdb(week)
    const stats = await syncCountry(env.DB, tmdb, 'FR', config, today)
    expect(stats).toEqual({ seen: 3, fetched: 3, added: 3, reReleases: 0, pending: 0 })

    const movies = await listMovies(env.DB, 'new')
    expect(movies.map(movie => movie.title).sort()).toEqual(['Les Contrebandiers', 'Resident Evil', 'Sham'])
    const evil = movies.find(movie => movie.tmdbId === 1)!
    expect(evil.releases).toEqual([{ country: 'FR', date: '2026-09-16', type: 3 }])
    expect(evil.trailerYoutubeKey).toBe('ev1')
    expect(evil.genres).toEqual([{ id: 18, name: 'Drame' }])
    expect(evil.status).toBe('new')
    expect(evil.createdAt).toBeTruthy()
  })

  it('asks the feed for the country and the window around today', async () => {
    const tmdb = fakeTmdb(week)
    await syncCountry(env.DB, tmdb, 'FR', config, today)
    expect(tmdb.calls.discover[0]).toMatchObject({ region: 'FR', from: '2026-08-23', to: '2026-09-27', page: 1 })
  })

  it('fetches English when the French synopsis is missing, and asks for the original-language trailer', async () => {
    const tmdb = fakeTmdb(week)
    await syncCountry(env.DB, tmdb, 'FR', config, today)
    const sham = (await listMovies(env.DB, 'new')).find(movie => movie.tmdbId === 3)!
    expect(sham.overview).toBe('Only in English so far.')
    const shamCalls = tmdb.calls.movie.filter(call => call.id === 3)
    expect(shamCalls.map(call => call.params.language ?? 'fr-FR')).toEqual(['fr-FR', 'en-US'])
    expect(shamCalls[0].params.originalLanguage).toBe('ko')
    // The others had a French synopsis and cost one call each.
    expect(tmdb.calls.movie.filter(call => call.id === 1)).toHaveLength(1)
  })

  it('is idempotent and never touches what the household decided', async () => {
    const tmdb = fakeTmdb(week)
    await syncCountry(env.DB, tmdb, 'FR', config, today)
    await env.DB.prepare(`UPDATE entries SET status = 'watchlist', added_at = 'then' WHERE tmdb_id = 1`).run()

    const stats = await syncCountry(env.DB, tmdb, 'FR', config, today)
    expect(stats).toEqual({ seen: 3, fetched: 0, added: 0, reReleases: 0, pending: 0 })
    expect(await countByStatus(env.DB)).toEqual({ new: 2, watchlist: 1, watched: 0, archived: 0 })
    expect(tmdb.calls.movie).toHaveLength(4) // 3 films + the English fallback, all on the first run
  })

  it('follows a release date that moved', async () => {
    await syncCountry(env.DB, fakeTmdb(week), 'FR', config, today)
    const postponed = week.map(film => (film.id === 2 ? { ...film, releaseDate: '2026-09-23' } : film))
    await syncCountry(env.DB, fakeTmdb(postponed), 'FR', config, today)
    const film = (await listMovies(env.DB, 'new')).find(movie => movie.tmdbId === 2)!
    expect(film.releases).toEqual([{ country: 'FR', date: '2026-09-23', type: 3 }])
  })

  it('leaves a known film’s date alone when the feed reports an earlier run', async () => {
    const classic: FakeFilm = {
      id: 5, title: 'Rivière de nuit', releaseDate: '2026-09-03', primaryReleaseDate: '2024-01-01', overviewFr: 'Un classique.',
      releaseEntries: { FR: [{ type: 3, date: '2024-03-06' }, { type: 3, date: '2026-09-03' }] }
    }
    await syncCountry(env.DB, fakeTmdb([classic]), 'FR', config, today)
    // Next hour the feed lists it again, but with its first French date.
    await syncCountry(env.DB, fakeTmdb([{ ...classic, releaseDate: '2024-03-06' }]), 'FR', config, today)
    const film = (await listMovies(env.DB, 'new')).find(movie => movie.tmdbId === 5)!
    expect(film.releases).toEqual([{ country: 'FR', date: '2026-09-03', type: 3 }])
  })

  it('dates a classic back in cinemas by its current run, then stores it as a re-release', async () => {
    const classic: FakeFilm = {
      id: 6, title: 'Rivière de nuit', releaseDate: '2024-03-06', primaryReleaseDate: '1956-09-12', overviewFr: 'Un classique.',
      releaseEntries: { FR: [{ type: 3, date: '2024-03-06' }, { type: 3, date: '2026-09-03' }] }
    }
    const stats = await syncCountry(env.DB, fakeTmdb([classic]), 'FR', config, today)
    expect(stats).toMatchObject({ fetched: 1, added: 0, reReleases: 1 })
    const row = await env.DB.prepare(`SELECT release_date FROM releases WHERE tmdb_id = 6`).first<{ release_date: string }>()
    expect(row?.release_date).toBe('2026-09-03')
  })

  it('stores a re-release without offering it for review, and does not fetch it again', async () => {
    const films: FakeFilm[] = [...week, { id: 99, title: 'Avengers: Endgame', releaseDate: '2026-09-16', primaryReleaseDate: '2019-04-24', overviewFr: 'Encore.' }]
    const tmdb = fakeTmdb(films)
    const stats = await syncCountry(env.DB, tmdb, 'FR', config, today)
    expect(stats).toMatchObject({ seen: 4, fetched: 4, added: 3, reReleases: 1 })
    expect((await listMovies(env.DB, 'new')).map(movie => movie.tmdbId)).not.toContain(99)
    expect(await env.DB.prepare(`SELECT COUNT(*) AS n FROM movies WHERE tmdb_id = 99`).first<{ n: number }>()).toEqual({ n: 1 })

    const again = await syncCountry(env.DB, tmdb, 'FR', config, today)
    expect(again.fetched).toBe(0)
  })

  it('fetches a bounded number of new films per run and reports the rest as pending', async () => {
    const many: FakeFilm[] = Array.from({ length: 25 }, (_, i) => ({ id: 100 + i, releaseDate: '2026-09-16', overviewFr: 'x' }))
    const tmdb = fakeTmdb(many)
    const first = await syncCountry(env.DB, tmdb, 'FR', config, today)
    expect(first).toMatchObject({ seen: 25, fetched: 10, added: 10, pending: 15 })
    expect(tmdb.calls.discover).toHaveLength(2) // 25 films = two pages of 20

    const second = await syncCountry(env.DB, tmdb, 'FR', config, today)
    expect(second).toMatchObject({ fetched: 10, added: 10, pending: 5 })
    const third = await syncCountry(env.DB, tmdb, 'FR', config, today)
    expect(third).toMatchObject({ fetched: 5, added: 5, pending: 0 })
    expect((await countByStatus(env.DB)).new).toBe(25)
  })

  it('records each run', async () => {
    await syncCountry(env.DB, fakeTmdb(week), 'FR', config, today)
    const run = await env.DB.prepare(`SELECT * FROM sync_runs ORDER BY id DESC LIMIT 1`).first<{ country: string; stats: string; finished_at: string }>()
    expect(run?.country).toBe('FR')
    expect(run?.finished_at).toBeTruthy()
    expect(JSON.parse(run!.stats)).toMatchObject({ added: 3 })
  })
})
