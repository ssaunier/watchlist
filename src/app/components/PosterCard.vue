<script setup>
/**
 * The deck card: the poster, and over its foot the few words that decide a
 * swipe. Tapping it opens the synopsis; the parent handles the gesture.
 */
import { useMovieText } from '../composables/useMovieText.js'
import { posterUrl } from '../services/images.js'
import RatingsLine from './RatingsLine.vue'

const props = defineProps({
  movie: { type: Object, required: true },
  /** Behind the top card the details are hidden; only the poster shows. */
  muted: { type: Boolean, default: false }
})
const { factsLine, genresLine, releaseText, ratings } = useMovieText(() => props.movie)
</script>

<template>
  <div class="relative size-full overflow-hidden rounded-poster bg-ink-2 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.8)]">
    <img
      v-if="movie.posterPath"
      :src="posterUrl(movie.posterPath)"
      :alt="movie.title"
      draggable="false"
      class="size-full select-none object-cover"
    />
    <div v-else class="grid size-full place-items-center px-6 text-center">
      <span class="display text-3xl text-mist">{{ movie.title }}</span>
    </div>

    <div v-if="!muted" class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink via-ink/85 to-transparent px-5 pt-24 pb-5">
      <h2 class="display text-[1.85rem] text-cream text-balance">{{ movie.title }}</h2>
      <p class="mt-1.5 text-[15px] text-cream/90">{{ factsLine }}</p>
      <p v-if="genresLine" class="text-[15px] text-mist">{{ genresLine }}</p>
      <RatingsLine :ratings="ratings" size="text-[14px]" class="mt-1.5" />
      <p v-if="releaseText" class="mt-1.5 text-[13px] text-mist">{{ releaseText }}</p>
    </div>

  </div>
</template>
