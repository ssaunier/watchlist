import { LOCALES } from '../i18n/locales.js'

/**
 * The two per-device conveniences the app remembers. Everything about films
 * lives in the database behind the API; this is only which language and
 * which sort order this browser last chose.
 */
const LOCALE_KEY = 'watchlist:locale:v1'
const SORT_KEY = 'watchlist:sort:v1'

function read(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private mode or storage disabled: the choice just does not stick.
  }
}

/** Returns the stored locale, or null when nothing valid is stored. */
export function loadLocale() {
  const value = read(LOCALE_KEY)
  return LOCALES.includes(value) ? value : null
}

export function saveLocale(value) {
  if (LOCALES.includes(value)) write(LOCALE_KEY, value)
}

/** The sort each list was left on, keyed by list name. */
export function loadSorts() {
  try {
    const value = JSON.parse(read(SORT_KEY) || '{}')
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

export function saveSorts(value) {
  write(SORT_KEY, JSON.stringify(value))
}
