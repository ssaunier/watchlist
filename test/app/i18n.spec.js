import { describe, expect, it } from 'vitest'
import en from '../../src/app/i18n/en.js'
import fr from '../../src/app/i18n/fr.js'
import { frenchPlural } from '../../src/app/i18n/index.js'
import { browserLocale } from '../../src/app/i18n/locales.js'

function keys(messages, prefix = '') {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`]
  )
}

describe('messages', () => {
  it('exist in both languages', () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort())
  })
})

describe('frenchPlural', () => {
  it('keeps the singular for 0 and 1', () => {
    expect(frenchPlural(0, 2)).toBe(0)
    expect(frenchPlural(1, 2)).toBe(0)
    expect(frenchPlural(2, 2)).toBe(1)
  })
})

describe('browserLocale', () => {
  it('matches on the primary subtag and ignores languages we do not have', () => {
    expect(browserLocale(['fr-CA', 'en'])).toBe('fr')
    expect(browserLocale(['de', 'en-GB'])).toBe('en')
    expect(browserLocale(['de'])).toBeNull()
  })
})
