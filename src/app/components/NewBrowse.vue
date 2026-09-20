<script setup>
/**
 * New, for a wide screen: every film of the last weeks at once, grouped by
 * the Wednesday it came out, each with its two buttons. The poster opens
 * the synopsis.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocale } from '../composables/useLocale.js'
import { releaseWeek, formatDayShort } from '../services/dates.js'
import NewTile from './NewTile.vue'

const props = defineProps({ movies: { type: Array, required: true } })
defineEmits(['keep', 'pass', 'open'])
const { t } = useI18n()
const { locale } = useLocale()

const weeks = computed(() => {
  const groups = new Map()
  for (const movie of props.movies) {
    const week = releaseWeek(movie.releases[0]?.date || movie.primaryReleaseDate || '')
    if (!groups.has(week)) groups.set(week, [])
    groups.get(week).push(movie)
  }
  return [...groups].map(([week, items]) => ({ week, movies: items }))
})
</script>

<template>
  <div class="space-y-10">
    <section v-for="group in weeks" :key="group.week">
      <h2 class="display mb-4 text-xl text-mist">{{ t('deck.weekOf', { date: formatDayShort(group.week, locale) }) }}</h2>
      <div class="grid grid-cols-3 gap-x-4 gap-y-6 lg:grid-cols-5 xl:grid-cols-6">
        <NewTile v-for="movie in group.movies" :key="movie.tmdbId" :movie="movie" @keep="$emit('keep', movie)" @pass="$emit('pass', movie)" @open="$emit('open', movie)" />
      </div>
    </section>
  </div>
</template>
