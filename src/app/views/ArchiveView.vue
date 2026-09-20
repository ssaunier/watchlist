<script setup>
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMovies } from '../composables/useMovies.js'
import { useSheet } from '../composables/useSheet.js'
import PosterGrid from '../components/PosterGrid.vue'
import MovieSheet from '../components/MovieSheet.vue'
import TrailerModal from '../components/TrailerModal.vue'
import PillButton from '../components/PillButton.vue'
import EmptyState from '../components/EmptyState.vue'

const { t } = useI18n()
const { lists, loading, load, move } = useMovies()
const sheet = useSheet()

/** Most recently archived first. */
const movies = computed(() => [...(lists.archived || [])].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))))

async function moveTo(movie, status) {
  sheet.close()
  await move(movie, status)
}

onMounted(() => load('archived'))
</script>

<template>
  <section>
    <header class="mb-5">
      <h1 class="display text-3xl text-cream">{{ t('archive.title') }}</h1>
      <p class="mt-1 max-w-md text-[14px] leading-5 text-mist">{{ t('archive.intro') }}</p>
    </header>

    <div v-if="loading.archived && !movies.length" class="py-24 text-center text-[15px] text-mist">{{ t('app.loading') }}</div>
    <EmptyState v-else-if="!movies.length" :title="t('archive.emptyTitle')" :hint="t('archive.emptyHint')" />
    <PosterGrid v-else :movies="movies" @select="sheet.open" />

    <MovieSheet :movie="sheet.selected.value" @close="sheet.close" @trailer="sheet.playTrailer">
      <PillButton primary @click="moveTo(sheet.selected.value, 'watchlist')">{{ t('common.addToWatchlist') }}</PillButton>
      <PillButton @click="moveTo(sheet.selected.value, 'new')">{{ t('archive.backToNew') }}</PillButton>
    </MovieSheet>
    <TrailerModal :youtube-key="sheet.trailer.value?.trailerYoutubeKey ?? null" :title="sheet.trailer.value?.title ?? ''" @close="sheet.stopTrailer" />
  </section>
</template>
