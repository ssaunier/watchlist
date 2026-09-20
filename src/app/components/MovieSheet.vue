<script setup>
/**
 * Everything about one film, sliding up from the bottom of the phone (a
 * centred panel on a wider screen): the synopsis, the trailer, and in the
 * default slot whatever the current list lets you do with it.
 */
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMovieText } from '../composables/useMovieText.js'
import { posterUrl, trailerSearchUrl } from '../services/images.js'
import { formatDay } from '../services/dates.js'
import StarRating from './StarRating.vue'

const props = defineProps({ movie: { type: Object, default: null } })
const emit = defineEmits(['close', 'trailer'])
const { t } = useI18n()
const dialog = ref(null)
const { factsLine, genresLine, releaseDate, showOriginalTitle, locale } = useMovieText(() => props.movie)

watch(() => props.movie, movie => {
  if (movie) {
    dialog.value?.showModal()
    dialog.value?.scrollTo?.(0, 0)
  } else dialog.value?.close()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-3xl bg-ink-2 p-0 text-cream sm:m-auto sm:max-w-lg sm:rounded-3xl"
    @cancel.prevent="emit('close')"
    @click.self="emit('close')"
  >
    <div v-if="movie" class="px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
      <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-3 sm:hidden" aria-hidden="true"></div>

      <div class="flex gap-4">
        <div class="w-24 shrink-0 overflow-hidden rounded-xl bg-ink shadow-[0_10px_30px_-14px_rgb(0_0_0/0.9)]" style="aspect-ratio: 2 / 3;">
          <img v-if="movie.posterPath" :src="posterUrl(movie.posterPath, 'w342')" :alt="''" class="size-full object-cover" />
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="display text-2xl text-cream text-balance">{{ movie.title }}</h2>
          <p v-if="showOriginalTitle" class="mt-1 text-[14px] text-mist">{{ movie.originalTitle }}</p>
          <p class="mt-2 text-[15px] text-cream/90">{{ factsLine }}</p>
          <p v-if="genresLine" class="text-[15px] text-mist">{{ genresLine }}</p>
          <p v-if="releaseDate" class="mt-2 text-[13px] text-mist">{{ t('film.inCinemas', { date: releaseDate }) }}</p>
        </div>
      </div>

      <div v-if="movie.status === 'watched'" class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <StarRating v-if="movie.rating" :model-value="movie.rating" />
        <span v-if="movie.rating" class="display text-lg text-gold">{{ t('film.rating', { n: movie.rating }) }}</span>
        <span v-if="movie.watchedAt" class="text-[13px] text-mist">{{ t('film.watchedOn', { date: formatDay(movie.watchedAt, locale) }) }}</span>
        <p v-if="movie.note" class="w-full text-[15px] leading-6 text-cream/90">{{ movie.note }}</p>
      </div>

      <button
        v-if="movie.trailerYoutubeKey"
        type="button"
        @click="emit('trailer', movie)"
        class="mt-4 inline-flex items-center gap-2 rounded-full border border-ink-3 px-4 py-2 text-[15px] font-semibold text-cream hover:border-mist"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="size-4"><path d="M8 5.5v13l11-6.5z" /></svg>
        {{ t('film.trailer') }}
      </button>
      <a
        v-else
        :href="trailerSearchUrl(movie, locale)"
        target="_blank"
        rel="noreferrer"
        class="mt-4 inline-flex items-center gap-2 rounded-full border border-ink-3 px-4 py-2 text-[15px] font-semibold text-mist hover:border-mist hover:text-cream"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" class="size-4"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        {{ t('film.findTrailer') }}
      </a>

      <p class="mt-4 text-[15px] leading-7 text-cream/90">{{ movie.overview || t('film.noOverview') }}</p>

      <!-- The quiet action sits left, the main one right: far apart, so a thumb cannot slip from one to the other. -->
      <div class="mt-6 flex flex-wrap items-center justify-between gap-2">
        <slot />
      </div>
    </div>
  </dialog>
</template>
