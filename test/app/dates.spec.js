import { describe, expect, it } from 'vitest'
import { relativeDay, releaseWeek, formatDay, languageName, parseDay, daysBetween } from '../../src/app/services/dates.js'

const now = new Date('2026-09-20T15:00:00Z')

describe('relativeDay', () => {
  it('counts days, then weeks, then months, then years', () => {
    expect(relativeDay('2026-09-20', 'en', now)).toBe('today')
    expect(relativeDay('2026-09-19', 'en', now)).toBe('yesterday')
    expect(relativeDay('2026-09-16', 'en', now)).toBe('4 days ago')
    expect(relativeDay('2026-08-26', 'en', now)).toBe('4 weeks ago')
    expect(relativeDay('2026-02-18', 'en', now)).toBe('7 months ago')
    expect(relativeDay('2024-09-18', 'en', now)).toBe('2 years ago')
  })

  it('looks ahead too', () => {
    expect(relativeDay('2026-09-23', 'en', now)).toBe('in 3 days')
    expect(relativeDay('2026-09-23', 'fr', now)).toBe('dans 3 jours')
  })

  it('is empty for a missing or broken date', () => {
    expect(relativeDay(null, 'en', now)).toBe('')
    expect(relativeDay('nope', 'en', now)).toBe('')
  })
})

describe('releaseWeek', () => {
  it('is the Wednesday on or before the date', () => {
    expect(releaseWeek('2026-09-16')).toBe('2026-09-16') // a Wednesday
    expect(releaseWeek('2026-09-18')).toBe('2026-09-16') // Friday
    expect(releaseWeek('2026-09-22')).toBe('2026-09-16') // Tuesday
    expect(releaseWeek('2026-09-23')).toBe('2026-09-23')
    expect(releaseWeek('')).toBe('')
  })
})

describe('formatDay', () => {
  it('prints a short date in the locale, unaffected by the timezone', () => {
    expect(formatDay('2026-09-16', 'en')).toBe('Sep 16, 2026')
    expect(formatDay('2026-09-16', 'fr')).toBe('16 sept. 2026')
    expect(formatDay('2026-09-16T23:30:00.000Z', 'en')).toBe('Sep 16, 2026')
  })
})

describe('languageName', () => {
  it('names a language in the UI language, keeping the code when it cannot', () => {
    expect(languageName('ko', 'en')).toBe('Korean')
    expect(languageName('ko', 'fr')).toBe('coréen')
    expect(languageName('', 'en')).toBe('')
  })
})

describe('parseDay and daysBetween', () => {
  it('work in whole UTC days', () => {
    expect(daysBetween(parseDay('2026-09-16'), parseDay('2026-09-20'))).toBe(4)
    expect(parseDay('garbage')).toBeNull()
  })
})
