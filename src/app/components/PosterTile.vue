<script setup>
/** A poster in a grid, with one line under it: when it came out, or the rating. */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMovieText } from '../composables/useMovieText.js'
import { posterUrl } from '../services/images.js'
import { relativeDay } from '../services/dates.js'

const props = defineProps({ movie: { type: Object, required: true } })
defineEmits(['select'])
const { t } = useI18n()
const { release, locale } = useMovieText(() => props.movie)

const caption = computed(() => {
  if (props.movie.status === 'watched') return props.movie.rating ? t('film.ratingShort', { n: props.movie.rating }) : ''
  return release.value ? relativeDay(release.value, locale.value) : ''
})
</script>

<template>
  <button type="button" class="group block w-full text-left" @click="$emit('select', movie)">
    <div class="aspect-[2/3] overflow-hidden rounded-xl bg-ink-2 shadow-[0_10px_30px_-14px_rgb(0_0_0/0.9)]">
      <img v-if="movie.posterPath" :src="posterUrl(movie.posterPath, 'w342')" :alt="''" loading="lazy" draggable="false" class="size-full object-cover transition group-active:scale-[0.98]" />
      <div v-else class="grid size-full place-items-center px-2 text-center text-xs text-mist">{{ movie.title }}</div>
    </div>
    <p class="mt-1.5 line-clamp-2 text-[13px] leading-tight text-cream">{{ movie.title }}</p>
    <p v-if="caption" :class="['text-[12px]', movie.status === 'watched' ? 'font-semibold text-gold' : 'text-mist']">{{ caption }}</p>
  </button>
</template>
