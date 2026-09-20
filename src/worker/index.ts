/**
 * The Worker: a small JSON API under /api for the Vue app, behind the
 * household's password, the hourly sync, and the front door for the app's
 * own files: plain http is sent to https, everything else is handed to the
 * static assets (see wrangler.jsonc). The files hold no data, so the
 * password only guards the API.
 */

import { Hono } from 'hono'
import { clearedSessionCookie, isAuthorized, safeEqual, sessionCookie, sessionToken } from './auth.ts'
import { countByStatus, getMovie, lastSyncRun, listMovies, updateEntry, STATUSES, type EntryPatch, type Status } from './db.ts'
import { syncAll, syncWindow } from './sync.ts'
import { syncAllocine, weeksForRun, wednesdaysIn } from './allocine.ts'
import { createTmdbClient } from './tmdb.ts'

export interface Env {
  DB: D1Database
  ASSETS?: Fetcher
  TMDB_TOKEN: string
  APP_PASSWORD: string
  RELEASE_COUNTRIES: string
  MAX_AGE_YEARS: string
  DETAILS_PER_RUN: string
}

/**
 * Where a film may go from each list. Archive is reachable from New and the
 * Watchlist; both ways out of Archive exist so changing one's mind never
 * means finding the film again, and a film just kept can go back to New
 * (the deck's undo).
 */
export const TRANSITIONS: Record<Status, Status[]> = {
  new: ['watchlist', 'archived'],
  watchlist: ['watched', 'archived', 'new'],
  watched: ['watchlist'],
  archived: ['new', 'watchlist']
}

export function canTransition(from: Status, to: Status): boolean {
  return TRANSITIONS[from].includes(to)
}

function isStatus(value: unknown): value is Status {
  return typeof value === 'string' && (STATUSES as string[]).includes(value)
}

const app = new Hono<{ Bindings: Env }>()

app.onError((error, c) => {
  console.error(error)
  return c.json({ error: error.message }, 500)
})

const isSecure = (c: { req: { url: string } }) => new URL(c.req.url).protocol === 'https:'

/** Where plain http is fine: `vite dev` on this machine, or a phone on the home network. */
export function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '::1' ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  )
}

const HSTS = 'max-age=31536000'

/** Plain http becomes https, for the API and the pages alike. */
app.use('*', async (c, next) => {
  const url = new URL(c.req.url)
  if (url.protocol === 'http:' && !isLocalHost(url.hostname)) {
    url.protocol = 'https:'
    return c.redirect(url.toString(), 301)
  }
  await next()
})

/** The password, as JSON, buys a cookie. */
app.post('/api/login', async c => {
  if (!c.env.APP_PASSWORD) return c.json({ error: 'APP_PASSWORD is not set' }, 500)
  const body = await c.req.json<{ password?: unknown }>().catch(() => ({}) as { password?: unknown })
  if (typeof body.password !== 'string' || !safeEqual(body.password, c.env.APP_PASSWORD)) return c.json({ error: 'wrong password' }, 401)
  c.header('Set-Cookie', sessionCookie(await sessionToken(c.env.APP_PASSWORD), isSecure(c)))
  return c.json({ ok: true })
})

app.post('/api/logout', c => {
  c.header('Set-Cookie', clearedSessionCookie(isSecure(c)))
  return c.json({ ok: true })
})

/** Everything else under /api needs the cookie, or the password as a bearer token. */
app.use('/api/*', async (c, next) => {
  if (!c.env.APP_PASSWORD) return c.json({ error: 'APP_PASSWORD is not set' }, 500)
  if (await isAuthorized(c.req.raw, c.env.APP_PASSWORD)) return next()
  return c.json({ error: 'unauthorized' }, 401)
})

app.get('/api/movies', async c => {
  const status = c.req.query('status')
  if (!isStatus(status)) return c.json({ error: `status must be one of ${STATUSES.join(', ')}` }, 400)
  return c.json(await listMovies(c.env.DB, status))
})

app.get('/api/movies/:id', async c => {
  const movie = await getMovie(c.env.DB, Number(c.req.param('id')))
  return movie ? c.json(movie) : c.json({ error: 'not found' }, 404)
})

app.patch('/api/movies/:id', async c => {
  const id = Number(c.req.param('id'))
  const movie = await getMovie(c.env.DB, id)
  if (!movie) return c.json({ error: 'not found' }, 404)

  const body = await c.req.json<{ status?: unknown; rating?: unknown; note?: unknown }>().catch(() => null)
  if (!body || typeof body !== 'object') return c.json({ error: 'expected a JSON object' }, 400)

  const now = new Date().toISOString()
  const patch: EntryPatch = {}

  if ('status' in body) {
    if (!isStatus(body.status)) return c.json({ error: 'invalid status' }, 400)
    if (body.status !== movie.status) {
      if (!canTransition(movie.status, body.status)) return c.json({ error: `cannot move from ${movie.status} to ${body.status}` }, 422)
      patch.status = body.status
      if (body.status === 'watchlist') patch.added_at = now
      if (body.status === 'watched') patch.watched_at = now
    }
  }

  if ('rating' in body) {
    const rating = body.rating
    if (rating !== null && !(Number.isInteger(rating) && (rating as number) >= 1 && (rating as number) <= 10)) {
      return c.json({ error: 'rating must be an integer from 1 to 10, or null' }, 400)
    }
    patch.rating = rating as number | null
  }

  if ('note' in body) {
    const note = body.note
    if (note !== null && typeof note !== 'string') return c.json({ error: 'note must be a string or null' }, 400)
    patch.note = note ? (note as string).slice(0, 2000) : null
  }

  if (Object.keys(patch).length) await updateEntry(c.env.DB, id, patch, now)
  return c.json(await getMovie(c.env.DB, id))
})

app.get('/api/counts', async c => c.json(await countByStatus(c.env.DB)))

app.get('/api/status', async c => {
  const [run, counts] = await Promise.all([lastSyncRun(c.env.DB), countByStatus(c.env.DB)])
  return c.json({
    lastSync: run ? { ...run, stats: run.stats ? JSON.parse(run.stats) : null } : null,
    counts,
    countries: c.env.RELEASE_COUNTRIES
  })
})

/** The same job the cron runs, on demand: handy after a deploy or to drain a backlog faster. */
app.post('/api/sync', async c => {
  const tmdb = createTmdbClient(c.env.TMDB_TOKEN)
  return c.json(await syncAll(c.env.DB, tmdb, c.env))
})

/** The app's files. Cloudflare answers index.html for the router's paths. */
app.get('*', async c => {
  if (c.req.path.startsWith('/api/') || !c.env.ASSETS) return c.notFound()
  const asset = await c.env.ASSETS.fetch(c.req.raw)
  if (!isSecure(c)) return asset
  // A fetched response's headers are read-only; copy it to add one.
  const response = new Response(asset.body, asset)
  response.headers.set('Strict-Transport-Security', HSTS)
  return response
})

/** Allociné ratings for every week of the window, on demand. */
app.post('/api/allocine', async c => {
  const window = syncWindow(new Date())
  return c.json(await syncAllocine(c.env.DB, wednesdaysIn(window), window))
})

app.notFound(c => c.json({ error: 'not found' }, 404))

export default {
  fetch: app.fetch,

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    const tmdb = createTmdbClient(env.TMDB_TOKEN)
    const now = new Date()
    ctx.waitUntil(
      (async () => {
        console.log('sync', JSON.stringify(await syncAll(env.DB, tmdb, env, now)))
        const window = syncWindow(now)
        console.log('allocine', JSON.stringify(await syncAllocine(env.DB, weeksForRun(window, now), window, fetch, now)))
      })()
    )
  }
} satisfies ExportedHandler<Env>
