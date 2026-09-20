/**
 * English is the default; French is the household's language and one click
 * away, and a browser that asks for French gets it without the click.
 */
export const DEFAULT_LOCALE = 'en'
export const LOCALES = ['en', 'fr']

/** The languages this browser asks for, in preference order. */
function requestedLanguages() {
  if (typeof navigator === 'undefined') return []
  return navigator.languages?.length ? navigator.languages : [navigator.language].filter(Boolean)
}

/**
 * The first language the browser asks for that we actually have, or null when
 * it asks for none of them. The tags are BCP 47 ('fr-CA', 'en-GB'), so only the
 * primary subtag is matched.
 */
export function browserLocale(tags = requestedLanguages()) {
  for (const tag of tags) {
    const primary = String(tag).toLowerCase().split('-')[0]
    if (LOCALES.includes(primary)) return primary
  }
  return null
}
