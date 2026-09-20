import { computed, toValue } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocale } from './useLocale.js'
import { languageName, relativeDay, formatDay, parseDay } from '../services/dates.js'
import { formatRuntime, joinList } from '../services/format.js'

/**
 * The words every film surface shares: which language it is in, how long it
 * runs, its genres in the UI language, and when it came out.
 */
export function useMovieText(movieRef, country = 'FR') {
  const { t, te } = useI18n()
  const { locale } = useLocale()

  const movie = computed(() => toValue(movieRef))
  const language = computed(() => {
    const name = movie.value ? languageName(movie.value.originalLanguage, locale.value) : ''
    return name.charAt(0).toLocaleUpperCase(locale.value) + name.slice(1)
  })
  const runtime = computed(() => (movie.value ? formatRuntime(movie.value.runtime) : ''))
  const genres = computed(() =>
    movie.value ? movie.value.genres.map(genre => (te(`genres.${genre.id}`) ? t(`genres.${genre.id}`) : genre.name)) : []
  )
  const release = computed(() => {
    if (!movie.value) return null
    const entry = movie.value.releases.find(item => item.country === country) || movie.value.releases[0]
    return entry?.date || movie.value.primaryReleaseDate || null
  })
  const upcoming = computed(() => {
    const day = parseDay(release.value)
    return day ? day > new Date() : false
  })
  const releaseText = computed(() => {
    if (!release.value) return ''
    const when = relativeDay(release.value, locale.value)
    return upcoming.value ? t('film.releasesOn', { when }) : t('film.released', { when })
  })
  const releaseDate = computed(() => (release.value ? formatDay(release.value, locale.value) : ''))

  /** "Korean, 1 h 41" */
  const factsLine = computed(() => joinList([language.value, runtime.value]))
  /** "Drama, Thriller" */
  const genresLine = computed(() => joinList(genres.value))
  const showOriginalTitle = computed(() => Boolean(movie.value?.originalTitle && movie.value.originalTitle !== movie.value.title))

  /** Allociné's ratings out of 5, "3,9" in French, "3.9" in English, press first. */
  const ratings = computed(() => {
    if (!movie.value) return []
    const format = new Intl.NumberFormat(locale.value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    return [
      { key: 'press', value: movie.value.pressRating, label: t('film.press') },
      { key: 'public', value: movie.value.publicRating, label: t('film.public') }
    ]
      .filter(entry => entry.value != null)
      .map(entry => ({ ...entry, text: format.format(entry.value) }))
  })

  return { language, runtime, genres, release, releaseText, releaseDate, factsLine, genresLine, showOriginalTitle, ratings, locale }
}
