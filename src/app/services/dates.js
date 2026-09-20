/** Date helpers; every input is an ISO string from the API, `now` is injectable for tests. */

const DAY = 24 * 60 * 60 * 1000

/** A YYYY-MM-DD as a UTC midnight, so days compare without timezone drift. */
export function parseDay(value) {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Whole days from `from` to `to`, negative when `to` is earlier. */
export function daysBetween(from, to) {
  return Math.round((to - from) / DAY)
}

/**
 * "3 weeks ago", "in 2 days", "7 months ago": days up to two weeks, then
 * weeks up to two months, then months, then years. Relative to the day, so
 * the hour of the visit does not change the wording.
 */
export function relativeDay(value, locale, now = new Date()) {
  const day = parseDay(value)
  if (!day) return ''
  const today = parseDay(now.toISOString())
  const days = daysBetween(today, day)
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const magnitude = Math.abs(days)
  if (magnitude < 14) return format.format(days, 'day')
  if (magnitude < 61) return format.format(Math.round(days / 7), 'week')
  if (magnitude < 365) return format.format(Math.round(days / 30.4), 'month')
  return format.format(Math.round(days / 365), 'year')
}

/** "16 Sept 2026" / "16 sept. 2026". */
export function formatDay(value, locale) {
  const day = parseDay(value)
  return day ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(day) : ''
}

/** "16 Sept" / "16 sept.", for headings that already sit in a year. */
export function formatDayShort(value, locale) {
  const day = parseDay(value)
  return day ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(day) : ''
}

/**
 * The Wednesday on or before a date, as YYYY-MM-DD. French films come out on
 * Wednesdays, so this is the week a release belongs to.
 */
export function releaseWeek(value) {
  const day = parseDay(value)
  if (!day) return ''
  const offset = (day.getUTCDay() - 3 + 7) % 7
  const wednesday = new Date(day.getTime() - offset * DAY)
  return wednesday.toISOString().slice(0, 10)
}

/** The name of a language from its ISO 639-1 code, in the UI's language. */
export function languageName(code, locale) {
  if (!code) return ''
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) || code
  } catch {
    return code
  }
}
