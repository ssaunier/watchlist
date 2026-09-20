<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMovies } from '../composables/useMovies.js'
import { useSortPreference } from '../composables/useSortPreference.js'
import { useSheet } from '../composables/useSheet.js'
import PosterGrid from '../components/PosterGrid.vue'
import MovieSheet from '../components/MovieSheet.vue'
import TrailerModal from '../components/TrailerModal.vue'
import RatingDialog from '../components/RatingDialog.vue'
import PillButton from '../components/PillButton.vue'
import SortControl from '../components/SortControl.vue'
import EmptyState from '../components/EmptyState.vue'

const { t } = useI18n()
const { lists, loading, load, move } = useMovies()
const { sort } = useSortPreference('watchlist', ['added', 'release', 'press', 'public'])
const sheet = useSheet()
const rating = ref(null)

const hasRatings = computed(() => (lists.watchlist || []).some(movie => movie.pressRating != null || movie.publicRating != null))

/** The rating sorts only appear once Allociné has rated something on the list. */
const sortOptions = computed(() => [
  { value: 'added', label: t('watchlist.sortAdded') },
  { value: 'release', label: t('watchlist.sortRelease') },
  ...(hasRatings.value ? [{ value: 'press', label: t('watchlist.sortPress') }, { value: 'public', label: t('watchlist.sortPublic') }] : [])
])

const releaseOf = movie => movie.releases[0]?.date || movie.primaryReleaseDate || ''
const byRating = key => (a, b) => (b[key] ?? -1) - (a[key] ?? -1) || String(b.addedAt).localeCompare(String(a.addedAt))

/** Added: newest first. Release date: oldest first, the ones most likely streamable by now. Ratings: best first, unrated last. */
const movies = computed(() => {
  const items = [...(lists.watchlist || [])]
  if (sort.value === 'release') return items.sort((a, b) => releaseOf(a).localeCompare(releaseOf(b)))
  if (sort.value === 'press') return items.sort(byRating('pressRating'))
  if (sort.value === 'public') return items.sort(byRating('publicRating'))
  return items.sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt)))
})

function startRating(movie) {
  sheet.close()
  rating.value = movie
}

async function watched({ rating: value, note }) {
  const movie = rating.value
  rating.value = null
  await move(movie, 'watched', { rating: value, note })
}

async function archive(movie) {
  sheet.close()
  await move(movie, 'archived')
}

onMounted(() => load('watchlist'))
</script>

<template>
  <section>
    <header class="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <h1 class="display text-3xl text-cream">{{ t('watchlist.title') }}</h1>
      <SortControl v-if="movies.length > 1" v-model="sort" :options="sortOptions" :label="t('common.sortBy')" />
    </header>

    <div v-if="loading.watchlist && !movies.length" class="py-24 text-center text-[15px] text-mist">{{ t('app.loading') }}</div>
    <EmptyState v-else-if="!movies.length" :title="t('watchlist.emptyTitle')" :hint="t('watchlist.emptyHint')" />
    <PosterGrid v-else :movies="movies" @select="sheet.open" />

    <MovieSheet :movie="sheet.selected.value" @close="sheet.close" @trailer="sheet.playTrailer">
      <PillButton @click="archive(sheet.selected.value)">{{ t('common.archive') }}</PillButton>
      <PillButton primary @click="startRating(sheet.selected.value)">{{ t('watchlist.markWatched') }}</PillButton>
    </MovieSheet>
    <RatingDialog :movie="rating" @confirm="watched" @cancel="rating = null" />
    <TrailerModal :youtube-key="sheet.trailer.value?.trailerYoutubeKey ?? null" :title="sheet.trailer.value?.title ?? ''" @close="sheet.stopTrailer" />
  </section>
</template>
