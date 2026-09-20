/**
 * Allociné's weekly release agenda, read for its press and spectator
 * ratings. There is no API: one HTML page per Wednesday lists that week's
 * films with their ratings, and a few regular expressions lift them out.
 * Films are tied to TMDB rows by title, since Allociné knows nothing of
 * TMDB ids.
 */

import { moviesReleasedBetween, updateRatings, type Statement } from './db.ts'
import { isoDate, addDays, type Window } from './sync.ts'

export interface AllocineFilm {
  allocineId: number
  title: string
  /** "16 septembre 2026", as printed; a re-release shows its first run's date. */
  dateText: string
  /** The same as YYYY-MM-DD, or null when it could not be read. */
  date: string | null
  pressRating: number | null
  publicRating: number | null
}

const FRENCH_MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** "16 septembre 2026" as "2026-09-16". */
export function parseFrenchDate(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})(?:er)?\s+([a-zéû]+)\s+(\d{4})$/i)
  if (!match) return null
  const month = FRENCH_MONTHS.indexOf(match[2].toLowerCase())
  if (month < 0) return null
  return `${match[3]}-${String(month + 1).padStart(2, '0')}-${match[1].padStart(2, '0')}`
}

export function agendaUrl(wednesday: string): string {
  return `https://www.allocine.fr/film/agenda/sem-${wednesday}/`
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const number = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isNaN(number) ? match : String.fromCodePoint(number)
    }
    return ENTITIES[code.toLowerCase()] ?? match
  })
}

/** "3,9" as printed by Allociné. */
function parseRating(text: string | undefined): number | null {
  if (!text) return null
  const value = Number(text.trim().replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

const CARD = /<div class="card entity-card entity-card-list cf">/
const TITLE = /<a class="meta-title-link" href="\/film\/fichefilm_gen_cfilm=(\d+)\.html">\s*([^<]+?)\s*<\/a>/
const DATE = /<span class="date">\s*([^<]+?)\s*<\/span>/
const RATING = /rating-title">\s*([^<]+?)\s*<[\s\S]*?stareval-note">\s*([^<]+?)\s*</g

export function parseAgenda(html: string): AllocineFilm[] {
  const films: AllocineFilm[] = []
  for (const card of html.split(CARD).slice(1)) {
    const title = card.match(TITLE)
    if (!title) continue
    const ratings: Record<string, number | null> = {}
    for (const match of card.matchAll(RATING)) ratings[match[1].toLowerCase()] = parseRating(match[2])
    const dateText = decodeEntities(card.match(DATE)?.[1] ?? '')
    films.push({
      allocineId: Number(title[1]),
      title: decodeEntities(title[2]),
      dateText,
      date: parseFrenchDate(dateText),
      pressRating: ratings.presse ?? null,
      publicRating: ratings.spectateurs ?? null
    })
  }
  return films
}

/** Lowercase, no accents, no punctuation: "L'Invitation" and "l invitation" meet here. */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** The same words in any order: Allociné and TMDB disagree on where a subtitle goes. */
function tokenKey(title: string): string {
  return normalizeTitle(title).split(' ').filter(Boolean).sort().join(' ')
}

export interface Candidate {
  tmdb_id: number
  title: string
  original_title: string
  /** The French release date, to keep a same-named film from another week away. */
  release_date?: string
}

/** How far apart the two sites may date the same release. */
const DATE_TOLERANCE_DAYS = 10

function daysApart(a: string, b: string): number {
  return Math.abs((new Date(`${a}T00:00:00Z`).getTime() - new Date(`${b}T00:00:00Z`).getTime()) / 86_400_000)
}

/** One title is the other plus a subtitle: "Toxic" and "Toxic - A Fairy Tale for Grown-Ups". */
function extendsTitle(a: string, b: string): boolean {
  return a.length > 0 && b.length > 0 && (a.startsWith(`${b} `) || b.startsWith(`${a} `))
}

/**
 * Pairs Allociné's films with TMDB rows: by exact normalised title first,
 * then by the same words in another order, then by one title extending the
 * other, when the dates agree. A film matching nothing, or more than one
 * row, is left out: a wrong match would put ratings on the wrong poster.
 */
export function matchFilms(films: AllocineFilm[], candidates: Candidate[]): Map<number, AllocineFilm> {
  const keyed = candidates.flatMap(candidate =>
    [...new Set([candidate.title, candidate.original_title])].map(title => ({ candidate, exact: normalizeTitle(title), tokens: tokenKey(title) }))
  )
  const sameWeek = (film: AllocineFilm, candidate: Candidate) =>
    !film.date || !candidate.release_date || daysApart(film.date, candidate.release_date) <= DATE_TOLERANCE_DAYS

  const matches = new Map<number, AllocineFilm>()
  for (const film of films) {
    const exact = normalizeTitle(film.title)
    const tokens = tokenKey(film.title)
    const passes = [
      keyed.filter(entry => entry.exact === exact),
      keyed.filter(entry => entry.tokens === tokens),
      keyed.filter(entry => extendsTitle(entry.exact, exact) && sameWeek(film, entry.candidate))
    ]
    const found = passes.find(entries => entries.length > 0) ?? []
    const ids = new Set(found.map(entry => entry.candidate.tmdb_id))
    if (ids.size !== 1) continue
    const candidate = found[0].candidate
    if (!sameWeek(film, candidate) || matches.has(candidate.tmdb_id)) continue
    matches.set(candidate.tmdb_id, film)
  }
  return matches
}

/** Every Wednesday in the window, oldest first. */
export function wednesdaysIn({ from, to }: Window): string[] {
  const days: string[] = []
  let day = new Date(`${from}T00:00:00Z`)
  day = addDays(day, (3 - day.getUTCDay() + 7) % 7)
  while (isoDate(day) <= to) {
    days.push(isoDate(day))
    day = addDays(day, 7)
  }
  return days
}

export interface AllocineStats {
  weeks: string[]
  listed: number
  matched: number
}

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

/**
 * Reads the given weeks' agendas and stores the ratings of the films they
 * share with the database. Each week is one page (about 500 KB), so the
 * caller keeps the list short per run.
 */
export async function syncAllocine(db: D1Database, weeks: string[], window: Window, fetchImpl: typeof fetch = fetch, now = new Date()): Promise<AllocineStats> {
  const films: AllocineFilm[] = []
  for (const week of weeks) {
    const response = await fetchImpl(agendaUrl(week), { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'fr-FR,fr;q=0.9' } })
    if (!response.ok) throw new Error(`Allociné returned ${response.status} for ${week}`)
    films.push(...parseAgenda(await response.text()))
  }
  const candidates = await moviesReleasedBetween(db, 'FR', window.from, window.to)
  const matches = matchFilms(films, candidates)
  const statements: Statement[] = []
  const fetchedAt = now.toISOString()
  for (const [tmdbId, film] of matches) {
    statements.push(updateRatings(db, { tmdb_id: tmdbId, allocine_id: film.allocineId, press_rating: film.pressRating, public_rating: film.publicRating, ratings_fetched_at: fetchedAt }))
  }
  if (statements.length) await db.batch(statements)
  return { weeks, listed: films.length, matched: matches.size }
}

/** Two of the window's weeks per run, rotating with the hour, so every week is refreshed a few times a day. */
export function weeksForRun(window: Window, now: Date, perRun = 2): string[] {
  const weeks = wednesdaysIn(window)
  if (weeks.length <= perRun) return weeks
  const start = now.getUTCHours() % weeks.length
  return Array.from({ length: perRun }, (_, i) => weeks[(start + i) % weeks.length])
}
