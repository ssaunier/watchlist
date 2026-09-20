<script setup>
/** A film in the New grid: the poster opens the synopsis, the two buttons decide. */
import { useI18n } from 'vue-i18n'
import { useMovieText } from '../composables/useMovieText.js'
import { posterUrl } from '../services/images.js'

const props = defineProps({ movie: { type: Object, required: true } })
defineEmits(['keep', 'pass', 'open'])
const { t } = useI18n()
const { factsLine, genresLine } = useMovieText(() => props.movie)
</script>

<template>
  <div class="flex flex-col">
    <button type="button" class="group block w-full text-left" @click="$emit('open', movie)">
      <div class="aspect-[2/3] overflow-hidden rounded-xl bg-ink-2 shadow-[0_10px_30px_-14px_rgb(0_0_0/0.9)]">
        <img v-if="movie.posterPath" :src="posterUrl(movie.posterPath, 'w342')" :alt="''" loading="lazy" draggable="false" class="size-full object-cover transition group-hover:scale-[1.03]" />
        <div v-else class="grid size-full place-items-center px-2 text-center text-xs text-mist">{{ movie.title }}</div>
      </div>
      <p class="mt-2 line-clamp-2 text-[14px] leading-tight text-cream">{{ movie.title }}</p>
      <p class="mt-0.5 truncate text-[12px] text-mist">{{ factsLine }}</p>
      <p v-if="genresLine" class="truncate text-[12px] text-mist">{{ genresLine }}</p>
    </button>
    <div class="mt-auto flex gap-1.5 pt-2">
      <button type="button" @click="$emit('pass', movie)" class="flex-1 rounded-full border border-ink-3 py-1 text-[13px] font-semibold text-mist transition hover:border-mist hover:text-cream">{{ t('deck.pass') }}</button>
      <button type="button" @click="$emit('keep', movie)" class="flex-1 rounded-full border border-gold py-1 text-[13px] font-semibold text-gold transition hover:bg-gold hover:text-gold-deep">{{ t('deck.keep') }}</button>
    </div>
  </div>
</template>
