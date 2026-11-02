/**
 * Fills Catch up, in the production database, with films that left cinemas
 * long ago. Run once from a laptop rather than by the Worker (it makes thousands of
 * requests). Every film released in French cinemas since `--all-from`, and
 * before that back to `--from` only those Allociné's spectators rate at
 * least `--min-public` out of 5. The sync's own filters apply: no
 * re-releases, nothing under an hour, only the ORIGIN_COUNTRIES of
 * wrangler.jsonc's production environment. Films already in the database
 * are left alone, and so are the last four weeks: the hourly sync's own.
 * Run it after the deploy that brought the Catch up list.
 *
 *   node --env-file=.dev.vars scripts/backfill.ts                # dry run: counts and a CSV
 *   node --env-file=.dev.vars scripts/backfill.ts --write        # and loads them into production
 *
 * Options: --from 2020-01-01 --all-from 2025-01-01 --min-public 4 --status catchup
 * TMDB and Allociné answers are cached in node_modules/.cache/backfill, so a
 * second run only fetches what is missing.
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { createTmdbClient, type DiscoverMovie, type DiscoverPage, type MovieDetails } from '../src/worker/tmdb.ts'
import { addDays, isoDate, isReRelease, isShort, isWantedOrigin, movieRowFrom, parseCountries, pickRelease, type Window } from '../src/worker/sync.ts'
import { agendaUrl, matchFilms, parseAgenda, wednesdaysIn, type AllocineFilm } from '../src/worker/allocine.ts'
import { STATUSES, type Status } from '../src/worker/db.ts'

const COUNTRY = 'FR'
const MAX_AGE_YEARS = 3
const CACHE = 'node_modules/.cache/backfill'
const OUT = 'node_modules/.cache/backfill-out'
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
/** How far an Allociné week and a TMDB date may disagree, as in matchFilms. */
const WEEK_SLACK_DAYS = 10

const { values: args } = parseArgs({
  options: {
    from: { type: 'string', default: '2020-01-01' },
    'all-from': { type: 'string', default: '2025-01-01' },
    'min-public': { type: 'string', default: '4' },
    status: { type: 'string', default: 'catchup' },
    write: { type: 'boolean', default: false }
  }
})
const minPublic = Number(args['min-public'])
const status = args.status as Status
if (!STATUSES.includes(status)) throw new Error(`--status must be one of ${STATUSES.join(', ')}`)
const token = process.env.TMDB_TOKEN
if (!token) throw new Error('TMDB_TOKEN is missing: run with --env-file=.dev.vars')

const wranglerConfig = readFileSync('wrangler.jsonc', 'utf8')
const productionConfig = wranglerConfig.slice(wranglerConfig.indexOf('"production"'))
const originCountries = parseCountries(productionConfig.match(/"ORIGIN_COUNTRIES":\s*"([^"]*)"/)?.[1])

mkdirSync(CACHE, { recursive: true })
mkdirSync(OUT, { recursive: true })

async function cached<T>(name: string, load: () => Promise<T>): Promise<T> {
  const path = join(CACHE, `${name}.json`)
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8'))
  const value = await load()
  writeFileSync(path, JSON.stringify(value))
  return value
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** TMDB answers 429 when pushed; wait and ask again. */
async function politeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(input, init)
    if ((response.status !== 429 && response.status < 500) || attempt === 4) return response
    await sleep(1000 * 2 ** attempt)
  }
}

async function inParallel<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await work(items[index])
    }
  }))
  return results
}

function wrangler(args: string[]): string {
  return execFileSync('npx', ['wrangler', 'd1', 'execute', 'watchlist-production', '--remote', '--env', 'production', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
}

/** Calendar months from `from` to `to`, as discover windows. */
function months(from: string, to: string): Window[] {
  const windows: Window[] = []
  let start = new Date(`${from.slice(0, 7)}-01T00:00:00Z`)
  while (isoDate(start) <= to) {
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0))
    windows.push({ from: isoDate(start), to: isoDate(end) < to ? isoDate(end) : to })
    start = addDays(end, 1)
  }
  return windows
}

const tmdb = createTmdbClient(token, politeFetch)
/** The sync looks 28 days back; everything after that is its business. */
const until = isoDate(addDays(new Date(), -29))
const now = new Date().toISOString()

// 1. What the database already holds, kept or not.
const known = new Set<number>(
  (JSON.parse(wrangler(['--json', '--command', 'SELECT tmdb_id FROM movies']))[0].results as { tmdb_id: number }[]).map(row => row.tmdb_id)
)
console.log(`production holds ${known.size} films; origin countries ${originCountries.join(',')}`)

// 2. Everything TMDB lists in French cinemas, month by month.
const feed = new Map<number, { movie: DiscoverMovie; window: Window }>()
for (const window of months(args.from, until)) {
  const fresh = window.to >= isoDate(addDays(new Date(), -40))
  const load = async () => {
    const movies: DiscoverMovie[] = []
    for (let page = 1; ; page++) {
      const result: DiscoverPage = await tmdb.discover({ region: COUNTRY, from: window.from, to: window.to, page })
      movies.push(...result.results)
      if (page >= result.total_pages || page >= 500) break
    }
    return movies
  }
  const movies = fresh ? await load() : await cached(`discover-${window.from}`, load)
  for (const movie of movies) if (!feed.has(movie.id)) feed.set(movie.id, { movie, window })
}
console.log(`TMDB lists ${feed.size} films in ${COUNTRY} cinemas since ${args.from}`)

// 3. Allociné's ratings, one agenda page per Wednesday.
const ratings = new Map<number, AllocineFilm>()
const weeks = wednesdaysIn({ from: args.from, to: until })
for (const [i, week] of weeks.entries()) {
  const films = await cached(`allocine-${week}`, async () => {
    let response: Response
    // Allociné answers 429 after a couple of hundred pages: back off for a minute or two.
    for (let attempt = 0; ; attempt++) {
      await sleep(attempt ? 30_000 * attempt : 1000)
      response = await fetch(agendaUrl(week), { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'fr-FR,fr;q=0.9' } })
      if (response.status !== 429 || attempt === 5) break
      console.log(`allociné ${week}: 429, waiting`)
    }
    if (!response.ok) throw new Error(`Allociné returned ${response.status} for ${week}`)
    return parseAgenda(await response.text())
  })
  const lo = isoDate(addDays(new Date(`${week}T00:00:00Z`), -WEEK_SLACK_DAYS))
  const hi = isoDate(addDays(new Date(`${week}T00:00:00Z`), WEEK_SLACK_DAYS))
  const candidates = [...feed.values()]
    .filter(({ movie }) => movie.release_date >= lo && movie.release_date <= hi && !ratings.has(movie.id))
    .map(({ movie }) => ({ tmdb_id: movie.id, title: movie.title, original_title: movie.original_title, release_date: movie.release_date }))
  for (const [id, film] of matchFilms(films, candidates)) ratings.set(id, film)
  if (i % 50 === 0) console.log(`allociné ${week}: ${ratings.size} films matched so far`)
}
console.log(`Allociné rates ${ratings.size} of them`)

// 4. The candidates: recent films, and the older ones the spectators loved.
const wanted = [...feed.values()].filter(({ movie }) => {
  if (known.has(movie.id)) return false
  if (movie.release_date >= args['all-from']) return true
  return (ratings.get(movie.id)?.publicRating ?? 0) >= minPublic
})
console.log(`${wanted.length} candidates to look up`)

// 5. Their details, and the sync's filters.
const reasons = { reRelease: 0, short: 0, otherOrigin: 0 }
const kept: { details: MovieDetails; overview: string; release: { date: string; type: number }; rating?: AllocineFilm }[] = []
let done = 0
await inParallel(wanted, 8, async ({ movie, window }) => {
  const details = await cached(`movie-${movie.id}`, () => tmdb.movie(movie.id, { originalLanguage: movie.original_language }))
  let overview = details.overview
  if (!overview) overview = (await cached(`movie-${movie.id}-en`, () => tmdb.movie(movie.id, { language: 'en-US', originalLanguage: movie.original_language }))).overview
  if (++done % 200 === 0) console.log(`details ${done}/${wanted.length}`)
  const release = pickRelease(details, COUNTRY, movie.release_date, window)
  if (isReRelease(details.release_date, release.date, MAX_AGE_YEARS)) reasons.reRelease++
  else if (isShort(details.runtime)) reasons.short++
  else if (!isWantedOrigin(details.origin_country, originCountries)) reasons.otherOrigin++
  else kept.push({ details, overview, release, rating: ratings.get(movie.id) })
})
kept.sort((a, b) => a.release.date.localeCompare(b.release.date))

const recent = kept.filter(film => film.release.date >= args['all-from']).length
console.log(`skipped: ${reasons.reRelease} re-releases, ${reasons.short} under an hour, ${reasons.otherOrigin} other origins`)
console.log(`kept ${kept.length}: ${recent} since ${args['all-from']}, ${kept.length - recent} older rated ${minPublic}+`)

const csv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
writeFileSync(
  join(OUT, 'kept.csv'),
  ['release,title,original_title,origin,runtime,press,public']
    .concat(kept.map(({ details, release, rating }) =>
      [release.date, details.title, details.original_title, (details.origin_country ?? []).join(' '), details.runtime, rating?.pressRating, rating?.publicRating].map(csv).join(',')
    ))
    .join('\n')
)

// 6. One SQL file; nothing that is already there is touched.
const sql = (value: unknown) => (value === null || value === undefined ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replace(/'/g, "''")}'`)
const statements = kept.flatMap(({ details, overview, release, rating }) => {
  const row = movieRowFrom(details, overview, now)
  return [
    `INSERT INTO movies (tmdb_id, title, original_title, original_language, overview, genres, runtime, poster_path, primary_release_date, trailer_youtube_key, tmdb_vote_average, tmdb_vote_count, tmdb_json, fetched_at, allocine_id, press_rating, public_rating, ratings_fetched_at) VALUES (${[
      row.tmdb_id, row.title, row.original_title, row.original_language, row.overview, row.genres, row.runtime, row.poster_path, row.primary_release_date,
      row.trailer_youtube_key, row.tmdb_vote_average, row.tmdb_vote_count, row.tmdb_json, row.fetched_at,
      rating?.allocineId, rating?.pressRating, rating?.publicRating, rating ? now : null
    ].map(sql).join(', ')}) ON CONFLICT(tmdb_id) DO NOTHING;`,
    `INSERT INTO releases (tmdb_id, country, release_date, release_type) VALUES (${[row.tmdb_id, COUNTRY, release.date, release.type].map(sql).join(', ')}) ON CONFLICT(tmdb_id, country) DO NOTHING;`,
    `INSERT OR IGNORE INTO entries (tmdb_id, status, created_at, updated_at) VALUES (${[row.tmdb_id, status, now, now].map(sql).join(', ')});`
  ]
})
const sqlPath = join(OUT, 'backfill.sql')
writeFileSync(sqlPath, statements.join('\n') + '\n')
console.log(`wrote ${join(OUT, 'kept.csv')} and ${sqlPath}`)

if (args.write && kept.length) {
  console.log(`loading ${kept.length} films into production as "${status}"`)
  wrangler(['--file', sqlPath, '--yes'])
  console.log('done')
}
