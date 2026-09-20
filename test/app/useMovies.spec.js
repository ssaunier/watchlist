import { beforeEach, describe, expect, it, vi } from 'vitest'

/** A fetch that answers the API from an in-memory table of films. */
function fakeApi(films) {
  const patches = []
  const fetch = vi.fn(async (url, init = {}) => {
    const { pathname, searchParams } = new URL(url, 'http://test')
    const json = (body, status = 200) => ({ ok: status < 400, status, statusText: '', json: async () => body })
    if (pathname === '/api/movies') return json(films.filter(film => film.status === searchParams.get('status')))
    const match = pathname.match(/^\/api\/movies\/(\d+)$/)
    if (match && init.method === 'PATCH') {
      const film = films.find(entry => entry.tmdbId === Number(match[1]))
      const patch = JSON.parse(init.body)
      patches.push({ id: film.tmdbId, patch })
      if (patch.status === 'watched' && film.status === 'new') return json({ error: 'cannot move from new to watched' }, 422)
      Object.assign(film, patch)
      return json({ ...film })
    }
    if (pathname === '/api/status') {
      const counts = { new: 0, watchlist: 0, watched: 0, archived: 0 }
      for (const film of films) counts[film.status]++
      return json({ counts, lastSync: { finished_at: '2026-09-20T08:00:00Z' }, countries: 'FR' })
    }
    return json({ error: 'not found' }, 404)
  })
  return { fetch, patches }
}

let useMovies

beforeEach(async () => {
  vi.resetModules()
  ;({ useMovies } = await import('../../src/app/composables/useMovies.js'))
})

describe('useMovies', () => {
  it('loads a list once and keeps its count', async () => {
    const api = fakeApi([{ tmdbId: 1, status: 'new' }, { tmdbId: 2, status: 'new' }, { tmdbId: 3, status: 'watchlist' }])
    vi.stubGlobal('fetch', api.fetch)
    const { load, lists, counts } = useMovies()
    await load('new')
    await load('new')
    expect(lists.new).toHaveLength(2)
    expect(counts.new).toBe(2)
    expect(api.fetch).toHaveBeenCalledTimes(1)
  })

  it('moves a film out of its list at once and forgets the destination list', async () => {
    const api = fakeApi([{ tmdbId: 1, status: 'new' }, { tmdbId: 2, status: 'new' }])
    vi.stubGlobal('fetch', api.fetch)
    const { load, lists, counts, move } = useMovies()
    await load('new')
    await load('watchlist')
    const [first] = lists.new
    const pending = move(first, 'watchlist')
    expect(lists.new).toHaveLength(1)
    expect(lists.watchlist).toBeNull()
    expect(counts).toMatchObject({ new: 1, watchlist: 1 })
    await pending
    expect(first.status).toBe('watchlist')
    expect(api.patches).toEqual([{ id: 1, patch: { status: 'watchlist' } }])
  })

  it('puts the film back when the server refuses', async () => {
    const api = fakeApi([{ tmdbId: 1, status: 'new' }])
    vi.stubGlobal('fetch', api.fetch)
    const { load, lists, counts, move, error } = useMovies()
    await load('new')
    await expect(move(lists.new[0], 'watched')).rejects.toThrow(/cannot move/)
    expect(lists.new).toHaveLength(1)
    expect(counts).toMatchObject({ new: 1, watched: 0 })
    expect(error.value).toMatch(/cannot move/)
  })

  it('sends the rating along when marking as watched', async () => {
    const api = fakeApi([{ tmdbId: 1, status: 'watchlist' }])
    vi.stubGlobal('fetch', api.fetch)
    const { load, lists, move } = useMovies()
    await load('watchlist')
    await move(lists.watchlist[0], 'watched', { rating: 8, note: 'Great' })
    expect(api.patches[0].patch).toEqual({ status: 'watched', rating: 8, note: 'Great' })
  })

  it('takes a decision back, putting the film at the top of New without a reload', async () => {
    const api = fakeApi([{ tmdbId: 1, status: 'new' }, { tmdbId: 2, status: 'new' }])
    vi.stubGlobal('fetch', api.fetch)
    const { load, lists, counts, move, undo } = useMovies()
    await load('new')
    const [first] = lists.new
    await move(first, 'archived')
    expect(lists.new.map(movie => movie.tmdbId)).toEqual([2])
    await undo(first)
    expect(lists.new.map(movie => movie.tmdbId)).toEqual([1, 2])
    expect(first.status).toBe('new')
    expect(counts).toMatchObject({ new: 2, archived: 0 })
    expect(api.patches.at(-1)).toEqual({ id: 1, patch: { status: 'new' } })
  })

  it('reads counts and the last sync from the status endpoint', async () => {
    vi.stubGlobal('fetch', fakeApi([{ tmdbId: 1, status: 'archived' }]).fetch)
    const { refreshStatus, counts, lastSync, countries } = useMovies()
    await refreshStatus()
    expect(counts.archived).toBe(1)
    expect(lastSync.value.finished_at).toBe('2026-09-20T08:00:00Z')
    expect(countries.value).toBe('FR')
  })
})
