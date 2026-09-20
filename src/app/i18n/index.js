import { createI18n } from 'vue-i18n'
import { loadLocale } from '../services/storage.js'
import { browserLocale, DEFAULT_LOCALE } from './locales.js'
import en from './en.js'
import fr from './fr.js'

/**
 * vue-i18n's built-in plural rule is English and applied to every locale: for a
 * two-branch message it returns the plural branch for every count except 1, so
 * `0` would render "0 films". French keeps the singular for 0 and 1.
 */
export function frenchPlural(choice, choicesLength) {
  const count = Math.floor(Math.abs(choice))
  if (choicesLength === 2) return count < 2 ? 0 : 1
  return Math.min(count, 2)
}

export const i18n = createI18n({
  legacy: false,
  locale: loadLocale() || browserLocale() || DEFAULT_LOCALE,
  fallbackLocale: 'en',
  messages: { en, fr },
  pluralRules: { fr: frenchPlural }
})
