<script setup>
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMovies } from '../composables/useMovies.js'
import { useSortPreference } from '../composables/useSortPreference.js'
import { useSheet } from '../composables/useSheet.js'
import PosterGrid from '../components/PosterGrid.vue'
import MovieSheet from '../components/MovieSheet.vue'
import TrailerModal from '../components/TrailerModal.vue'
import PillButton from '../components/PillButton.vue'
import SortControl from '../components/SortControl.vue'
import EmptyState from '../components/EmptyState.vue'

const { t } = useI18n()
const { lists, loading, load, move } = useMovies()
const { sort } = useSortPreference('watched', ['date', 'rating'])
const sheet = useSheet()

const sortOptions = computed(() => [
  { value: 'date', label: t('watched.sortDate') },
  { value: 'rating', label: t('watched.sortRating') }
])

const movies = computed(() => {
  const items = [...(lists.watched || [])]
  if (sort.value === 'rating') return items.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || String(b.watchedAt).localeCompare(String(a.watchedAt)))
  return items.sort((a, b) => String(b.watchedAt).localeCompare(String(a.watchedAt)))
})

async function watchAgain(movie) {
  sheet.close()
  await move(movie, 'watchlist')
}

onMounted(() => load('watched'))
</script>

<template>
  <section>
    <header class="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <h1 class="display text-3xl text-cream">{{ t('watched.title') }}</h1>
      <SortControl v-if="movies.length > 1" v-model="sort" :options="sortOptions" :label="t('common.sortBy')" />
    </header>

    <div v-if="loading.watched && !movies.length" class="py-24 text-center text-[15px] text-mist">{{ t('app.loading') }}</div>
    <EmptyState v-else-if="!movies.length" :title="t('watched.emptyTitle')" :hint="t('watched.emptyHint')" />
    <PosterGrid v-else :movies="movies" @select="sheet.open" />

    <MovieSheet :movie="sheet.selected.value" @close="sheet.close" @trailer="sheet.playTrailer">
      <PillButton @click="watchAgain(sheet.selected.value)">{{ t('watched.watchAgain') }}</PillButton>
    </MovieSheet>
    <TrailerModal :youtube-key="sheet.trailer.value?.trailerYoutubeKey ?? null" :title="sheet.trailer.value?.title ?? ''" @close="sheet.stopTrailer" />
  </section>
</template>
