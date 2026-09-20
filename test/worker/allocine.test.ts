import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { agendaUrl, decodeEntities, matchFilms, normalizeTitle, parseAgenda, parseFrenchDate, syncAllocine, wednesdaysIn, weeksForRun } from '../../src/worker/allocine.ts'
import { syncCountry, syncWindow } from '../../src/worker/sync.ts'
import { listMovies } from '../../src/worker/db.ts'
import { fakeTmdb, resetDb } from './fixtures.ts'
import agenda from './fixtures/allocine-agenda.html?raw'

beforeEach(() => resetDb(env.DB))

describe('parseAgenda', () => {
  it('lifts every film with its id, title, date and ratings out of the page', () => {
    const films = parseAgenda(agenda)
    expect(films).toEqual([
      { allocineId: 1000018854, title: 'Resident Evil', dateText: '16 septembre 2026', date: '2026-09-16', pressRating: 3.9, publicRating: 3.8 },
      { allocineId: 317219, title: "L'Invitation", dateText: '16 septembre 2026', date: '2026-09-16', pressRating: 3.6, publicRating: 3.2 },
      { allocineId: 1000046254, title: 'The Transformers: The Movie 40th Anniversary', dateText: '17 septembre 2026', date: '2026-09-17', pressRating: null, publicRating: 3.1 },
      { allocineId: 321354, title: 'Festin boréal', dateText: '16 septembre 2026', date: '2026-09-16', pressRating: null, publicRating: null }
    ])
  })

  it('is empty for a page without films', () => {
    expect(parseAgenda('<html><body><ul></ul></body></html>')).toEqual([])
  })
})

describe('parseFrenchDate', () => {
  it('reads Allociné’s dates', () => {
    expect(parseFrenchDate('16 septembre 2026')).toBe('2026-09-16')
    expect(parseFrenchDate('1er août 2026')).toBe('2026-08-01')
    expect(parseFrenchDate('29 octobre 1946')).toBe('1946-10-29')
    expect(parseFrenchDate('Prochainement')).toBeNull()
  })
})

describe('decodeEntities and normalizeTitle', () => {
  it('turn Allociné’s text into something comparable', () => {
    expect(decodeEntities('L&#039;Invitation &amp; co &eacute;')).toBe("L'Invitation & co &eacute;")
    expect(normalizeTitle("L'Invitation")).toBe('l invitation')
    expect(normalizeTitle('Histoires De La Nuit')).toBe('histoires de la nuit')
    expect(normalizeTitle('Détective Conan : L’Ange Déchu')).toBe('detective conan l ange dechu')
  })
})

describe('matchFilms', () => {
  const film = (title: string, allocineId = 1, date: string | null = null) => ({ allocineId, title, dateText: '', date, pressRating: 3, publicRating: 4 })

  it('matches on the normalised title, then on the same words in another order', () => {
    const candidates = [
      { tmdb_id: 1, title: "L'Invitation", original_title: 'The Invitation' },
      { tmdb_id: 2, title: 'Jacques Henri Lartigue – La vie en relief', original_title: 'Jacques Henri Lartigue – La vie en relief' },
      { tmdb_id: 3, title: 'Sham', original_title: '샴' }
    ]
    const matches = matchFilms([film('L&#039;Invitation'.replace('&#039;', "'"), 10), film('La Vie en relief - Jacques Henri Lartigue', 20), film('Sham', 30), film('Unknown', 40)], candidates)
    expect([...matches.keys()]).toEqual([1, 2, 3])
    expect(matches.get(2)?.allocineId).toBe(20)
  })

  it('matches the original title too, and gives up when two films share a title', () => {
    const candidates = [
      { tmdb_id: 1, title: 'Titre français', original_title: 'The Original' },
      { tmdb_id: 2, title: 'Rose', original_title: 'Rose' },
      { tmdb_id: 3, title: 'Rose', original_title: 'Rosa' }
    ]
    const matches = matchFilms([film('The Original', 10), film('Rose', 20)], candidates)
    expect([...matches.keys()]).toEqual([1])
  })

  it('accepts a subtitle on either side when the dates agree', () => {
    const candidates = [
      { tmdb_id: 1, title: 'Toxic', original_title: 'ಟಾಕ್ಸಿಕ್', release_date: '2026-08-26' },
      { tmdb_id: 2, title: 'Détective Conan : L’Ange Déchu de l’Asphalte', original_title: '名探偵コナン', release_date: '2026-09-23' }
    ]
    const matches = matchFilms([film('Toxic - A Fairy Tale for Grown-Ups', 10, '2026-08-26'), film('Détective Conan', 20, '2026-09-23')], candidates)
    expect(matches.get(1)?.allocineId).toBe(10)
    expect(matches.get(2)?.allocineId).toBe(20)
    // The same subtitle match a month apart is another film.
    expect(matchFilms([film('Toxic - A Fairy Tale for Grown-Ups', 10, '2026-10-07')], candidates).size).toBe(0)
  })

  it('keeps a same-named film from another week apart, even on an exact title', () => {
    const candidates = [{ tmdb_id: 1, title: 'Les Autres', original_title: 'The Others', release_date: '2026-09-16' }]
    expect(matchFilms([film('Les Autres', 10, '2001-12-26')], candidates).size).toBe(0)
    expect(matchFilms([film('Les Autres', 10, '2026-09-18')], candidates).size).toBe(1)
    expect(matchFilms([film('Les Autres', 10, null)], candidates).size).toBe(1)
  })
})

describe('weeks', () => {
  it('lists the Wednesdays of the window and rotates through them', () => {
    const window = syncWindow(new Date('2026-09-20T10:00:00Z')) // 2026-08-23 .. 2026-09-27
    expect(wednesdaysIn(window)).toEqual(['2026-08-26', '2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23'])
    expect(weeksForRun(window, new Date('2026-09-20T00:00:00Z'))).toEqual(['2026-08-26', '2026-09-02'])
    expect(weeksForRun(window, new Date('2026-09-20T04:00:00Z'))).toEqual(['2026-09-23', '2026-08-26'])
    expect(agendaUrl('2026-09-16')).toBe('https://www.allocine.fr/film/agenda/sem-2026-09-16/')
  })
})

describe('syncAllocine', () => {
  const today = new Date('2026-09-20T10:00:00Z')
  const window = syncWindow(today)

  it('stores the ratings of the films it recognises, and remembers their Allociné ids', async () => {
    await syncCountry(
      env.DB,
      fakeTmdb([
        { id: 1, title: 'Resident Evil', originalLanguage: 'en', releaseDate: '2026-09-16', overviewFr: 'x' },
        { id: 2, title: "L'Invitation", originalTitle: 'The Invitation', originalLanguage: 'en', releaseDate: '2026-09-16', overviewFr: 'x' },
        { id: 3, title: 'Festin boréal', releaseDate: '2026-09-16', overviewFr: 'x' },
        { id: 4, title: 'Something else', releaseDate: '2026-09-16', overviewFr: 'x' }
      ]),
      'FR',
      { maxAgeYears: 3, detailsPerRun: 10 },
      today
    )
    const requested: string[] = []
    const fetchImpl = (async (url: RequestInfo | URL) => {
      requested.push(String(url))
      return new Response(agenda, { status: 200, headers: { 'Content-Type': 'text/html' } })
    }) as typeof fetch

    const stats = await syncAllocine(env.DB, ['2026-09-16'], window, fetchImpl, today)
    expect(requested).toEqual(['https://www.allocine.fr/film/agenda/sem-2026-09-16/'])
    expect(stats).toEqual({ weeks: ['2026-09-16'], listed: 4, matched: 3 })

    const movies = await listMovies(env.DB, 'new')
    const by = (id: number) => movies.find(movie => movie.tmdbId === id)!
    expect(by(1)).toMatchObject({ pressRating: 3.9, publicRating: 3.8, allocineId: 1000018854 })
    expect(by(2)).toMatchObject({ pressRating: 3.6, publicRating: 3.2, allocineId: 317219 })
    expect(by(3)).toMatchObject({ pressRating: null, publicRating: null, allocineId: 321354 })
    expect(by(4)).toMatchObject({ pressRating: null, publicRating: null, allocineId: null })
  })

  it('fails loudly when Allociné does not answer', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 503 })) as typeof fetch
    await expect(syncAllocine(env.DB, ['2026-09-16'], window, fetchImpl, today)).rejects.toThrow(/503/)
  })
})
