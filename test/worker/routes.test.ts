import { env, exports } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { syncCountry } from '../../src/worker/sync.ts'
import { canTransition, TRANSITIONS } from '../../src/worker/index.ts'
import { fakeTmdb, resetDb } from './fixtures.ts'

const worker = exports.default

/** Every call carries the password (set in vitest.worker.config.ts); the door itself is tested in auth.test.ts. */
async function api(path: string, init: RequestInit = {}) {
  const response = await worker.fetch(`https://watchlist.test${path}`, { ...init, headers: { Authorization: 'Bearer open-sesame', ...init.headers } })
  return { status: response.status, body: await response.json<any>() }
}

function patch(id: number, body: unknown) {
  return api(`/api/movies/${id}`, { method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
}

beforeEach(async () => {
  await resetDb(env.DB)
  await syncCountry(
    env.DB,
    fakeTmdb([
      { id: 1, title: 'Resident Evil', releaseDate: '2026-09-16', overviewFr: 'Un virus.' },
      { id: 2, title: 'Les Contrebandiers', releaseDate: '2026-09-16', overviewFr: 'Des contrebandiers.' }
    ]),
    'FR',
    { maxAgeYears: 3, detailsPerRun: 10 },
    new Date('2026-09-20T10:00:00Z')
  )
})

describe('transitions', () => {
  it('lets a film leave every list somewhere, and archive be undone', () => {
    for (const status of Object.keys(TRANSITIONS) as (keyof typeof TRANSITIONS)[]) expect(TRANSITIONS[status].length).toBeGreaterThan(0)
    expect(canTransition('new', 'watchlist')).toBe(true)
    expect(canTransition('new', 'watched')).toBe(false)
    expect(canTransition('watched', 'new')).toBe(false)
    expect(canTransition('archived', 'new')).toBe(true)
    expect(canTransition('watchlist', 'new')).toBe(true) // the deck's undo
  })
})

describe('GET /api/movies', () => {
  it('lists a status, and rejects an unknown one', async () => {
    const { status, body } = await api('/api/movies?status=new')
    expect(status).toBe(200)
    expect(body.map((movie: any) => movie.title).sort()).toEqual(['Les Contrebandiers', 'Resident Evil'])
    expect(body[0]).not.toHaveProperty('tmdb_json')
    expect((await api('/api/movies?status=nope')).status).toBe(400)
    expect((await api('/api/movies')).status).toBe(400)
  })

  it('serves one film, or 404', async () => {
    expect((await api('/api/movies/1')).body.title).toBe('Resident Evil')
    expect((await api('/api/movies/42')).status).toBe(404)
  })
})

describe('PATCH /api/movies/:id', () => {
  it('adds to the watchlist, stamping when', async () => {
    const { status, body } = await patch(1, { status: 'watchlist' })
    expect(status).toBe(200)
    expect(body.status).toBe('watchlist')
    expect(body.addedAt).toBeTruthy()
    expect((await api('/api/movies?status=new')).body).toHaveLength(1)
    expect((await api('/api/movies?status=watchlist')).body).toHaveLength(1)
  })

  it('marks as watched with a rating, stamping when', async () => {
    await patch(1, { status: 'watchlist' })
    const { body } = await patch(1, { status: 'watched', rating: 8, note: 'Great' })
    expect(body).toMatchObject({ status: 'watched', rating: 8, note: 'Great' })
    expect(body.watchedAt).toBeTruthy()
    expect(body.addedAt).toBeTruthy()
  })

  it('refuses a move the lists do not allow', async () => {
    const { status, body } = await patch(1, { status: 'watched' })
    expect(status).toBe(422)
    expect(body.error).toMatch(/cannot move from new to watched/)
    expect((await api('/api/movies/1')).body.status).toBe('new')
  })

  it('archives and restores', async () => {
    expect((await patch(1, { status: 'archived' })).body.status).toBe('archived')
    expect((await api('/api/counts')).body).toEqual({ new: 1, watchlist: 0, watched: 0, archived: 1 })
    expect((await patch(1, { status: 'new' })).body.status).toBe('new')
    expect((await patch(1, { status: 'archived' })).body.status).toBe('archived')
    expect((await patch(1, { status: 'watchlist' })).body.addedAt).toBeTruthy()
  })

  it('validates the rating and the note', async () => {
    expect((await patch(1, { rating: 11 })).status).toBe(400)
    expect((await patch(1, { rating: 0 })).status).toBe(400)
    expect((await patch(1, { rating: 7.5 })).status).toBe(400)
    expect((await patch(1, { rating: '8' })).status).toBe(400)
    expect((await patch(1, { note: 5 })).status).toBe(400)
    expect((await patch(1, { rating: 10 })).body.rating).toBe(10)
    expect((await patch(1, { rating: null })).body.rating).toBeNull()
    expect((await patch(1, { note: '' })).body.note).toBeNull()
  })

  it('rejects a bad status, a bad body and an unknown film', async () => {
    expect((await patch(1, { status: 'later' })).status).toBe(400)
    expect((await api('/api/movies/1', { method: 'PATCH', body: 'not json' })).status).toBe(400)
    expect((await patch(42, { status: 'watchlist' })).status).toBe(404)
  })

  it('leaves the film alone when the status is already the one asked for', async () => {
    await patch(1, { status: 'watchlist' })
    const before = (await api('/api/movies/1')).body
    const { status, body } = await patch(1, { status: 'watchlist' })
    expect(status).toBe(200)
    expect(body.addedAt).toBe(before.addedAt)
  })
})

describe('GET /api/status', () => {
  it('reports the last sync and the counts', async () => {
    const { body } = await api('/api/status')
    expect(body.counts).toEqual({ new: 2, watchlist: 0, watched: 0, archived: 0 })
    expect(body.lastSync.country).toBe('FR')
    expect(body.lastSync.stats).toMatchObject({ added: 2 })
    expect(body.countries).toBe('FR')
  })
})

it('keeps the Allociné refresh behind the password', async () => {
  const response = await worker.fetch('https://watchlist.test/api/allocine', { method: 'POST' })
  expect(response.status).toBe(401)
})

it('answers 404 in JSON for anything else under /api', async () => {
  expect(await api('/api/nothing')).toEqual({ status: 404, body: { error: 'not found' } })
})
