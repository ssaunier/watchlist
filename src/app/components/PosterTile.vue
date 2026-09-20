<script setup>
/** A poster in a grid: the title, then the rating once watched, else the language, runtime and genres as on New. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMovieText } from '../composables/useMovieText.js'
import { posterUrl } from '../services/images.js'
import PosterRatings from './PosterRatings.vue'

const props = defineProps({ movie: { type: Object, required: true } })
defineEmits(['select'])
const { t } = useI18n()
const { factsLine, genresLine, ratings } = useMovieText(() => props.movie)

const watched = computed(() => props.movie.status === 'watched')
const rating = computed(() => (watched.value && props.movie.rating ? t('film.ratingShort', { n: props.movie.rating }) : ''))
</script>

<template>
  <button type="button" class="group block w-full text-left" @click="$emit('select', movie)">
    <div class="relative aspect-[2/3] overflow-hidden rounded-xl bg-ink-2 shadow-[0_10px_30px_-14px_rgb(0_0_0/0.9)]">
      <img v-if="movie.posterPath" :src="posterUrl(movie.posterPath, 'w342')" :alt="''" loading="lazy" draggable="false" class="size-full object-cover transition group-active:scale-[0.98]" />
      <div v-else class="grid size-full place-items-center px-2 text-center text-xs text-mist">{{ movie.title }}</div>
      <PosterRatings :ratings="ratings" />
    </div>
    <p class="mt-1.5 line-clamp-2 text-[13px] leading-tight text-cream">{{ movie.title }}</p>
    <p v-if="rating" class="text-[12px] font-semibold text-gold">{{ rating }}</p>
    <template v-else-if="!watched">
      <p v-if="factsLine" class="mt-0.5 truncate text-[12px] text-mist">{{ factsLine }}</p>
      <p v-if="genresLine" class="truncate text-[12px] text-mist">{{ genresLine }}</p>
    </template>
  </button>
</template>
