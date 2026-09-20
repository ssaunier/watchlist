import { computed, watch } from 'vue'
import { i18n } from '../i18n/index.js'
import { LOCALES } from '../i18n/locales.js'
import { saveLocale } from '../services/storage.js'

/** Writable under `legacy: false`, so it can be both watched and assigned. */
const locale = i18n.global.locale

/** Rebuilt on locale change so every sort re-runs with the right collation. */
const collator = computed(() => new Intl.Collator(locale.value, { sensitivity: 'base' }))

function setLocale(value) {
  if (!LOCALES.includes(value)) return
  saveLocale(value)
  locale.value = value
}

// Module scope on purpose: the document tracks the locale from first import,
// before the app mounts, and for the lifetime of the page.
watch(locale, value => {
  document.documentElement.lang = value
  document.title = i18n.global.t('app.title')
}, { immediate: true })

export function useLocale() {
  return { locale, locales: LOCALES, setLocale, collator }
}
