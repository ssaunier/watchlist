<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMovies } from '../composables/useMovies.js'
import { useLocale } from '../composables/useLocale.js'
import { useSheet } from '../composables/useSheet.js'
import { useBreakpoint } from '../composables/useBreakpoint.js'
import { useSortPreference } from '../composables/useSortPreference.js'
import SwipeDeck from '../components/SwipeDeck.vue'
import DeckControls from '../components/DeckControls.vue'
import NewTile from '../components/NewTile.vue'
import MovieSheet from '../components/MovieSheet.vue'
import TrailerModal from '../components/TrailerModal.vue'
import PillButton from '../components/PillButton.vue'
import SortControl from '../components/SortControl.vue'
import EmptyState from '../components/EmptyState.vue'

/** A wide screen shows this many tiles, then more on request: the list runs to hundreds. */
const PAGE = 60

const { t } = useI18n()
const { collator } = useLocale()
const { lists, loading, load, move, undo } = useMovies()
const { sort } = useSortPreference('catchup', ['public', 'press', 'release'])
const sheet = useSheet()
const { isDesktop } = useBreakpoint()
const deck = ref(null)
const shown = ref(PAGE)

const sortOptions = computed(() => [
  { value: 'public', label: t('catchup.sortPublic') },
  { value: 'press', label: t('catchup.sortPress') },
  { value: 'release', label: t('catchup.sortRelease') }
])

const releaseOf = movie => movie.releases[0]?.date || movie.primaryReleaseDate || ''

/** Ratings: best first, unrated last. Release: most recent first. */
const movies = computed(() => {
  const items = [...(lists.catchup || [])]
  if (sort.value === 'release') return items.sort((a, b) => releaseOf(b).localeCompare(releaseOf(a)) || collator.value.compare(a.title, b.title))
  const key = sort.value === 'press' ? 'pressRating' : 'publicRating'
  return items.sort((a, b) => (b[key] ?? -1) - (a[key] ?? -1) || releaseOf(b).localeCompare(releaseOf(a)))
})

const top = computed(() => movies.value[0] || null)

/** The last few decisions, newest last, so a slip of the thumb can be taken back. */
const history = ref([])

async function decide(movie, status) {
  history.value = [...history.value.slice(-9), movie]
  try {
    await move(movie, status)
  } catch {
    history.value = history.value.filter(entry => entry !== movie)
  }
}

function fromSheet(status) {
  const movie = sheet.selected.value
  sheet.close()
  if (!isDesktop.value && movie === top.value) deck.value?.[status === 'watchlist' ? 'keep' : 'pass']()
  else decide(movie, status)
}

async function takeBack() {
  const movie = history.value.at(-1)
  if (!movie) return
  history.value = history.value.slice(0, -1)
  await undo(movie, 'catchup')
}

onMounted(() => load('catchup'))
</script>

<template>
  <section class="flex flex-col">
    <header class="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <div>
        <h1 class="display text-3xl text-cream">{{ t('catchup.title') }}</h1>
        <p class="mt-1 max-w-md text-[14px] leading-5 text-mist">{{ t('catchup.intro') }} {{ t('deck.remaining', { n: movies.length }) }}</p>
      </div>
      <div class="flex items-baseline gap-6">
        <button v-if="history.length && isDesktop" type="button" @click="takeBack" class="text-[14px] text-mist hover:text-cream">{{ t('deck.undo', { title: history.at(-1).title }) }}</button>
        <SortControl v-if="movies.length > 1" v-model="sort" :options="sortOptions" :label="t('common.sortBy')" />
      </div>
    </header>

    <div v-if="loading.catchup && !movies.length" class="py-24 text-center text-[15px] text-mist">{{ t('app.loading') }}</div>

    <template v-else-if="top && isDesktop">
      <div class="grid grid-cols-3 gap-x-4 gap-y-6 lg:grid-cols-5 xl:grid-cols-6">
        <NewTile v-for="movie in movies.slice(0, shown)" :key="movie.tmdbId" :movie="movie" @keep="decide(movie, 'watchlist')" @pass="decide(movie, 'archived')" @open="sheet.open(movie)" />
      </div>
      <button v-if="movies.length > shown" type="button" @click="shown += PAGE" class="mx-auto mt-8 rounded-full px-4 py-2 text-[14px] text-mist hover:text-cream">
        {{ t('catchup.showMore', { n: Math.min(PAGE, movies.length - shown) }) }}
      </button>
    </template>

    <template v-else-if="top">
      <SwipeDeck ref="deck" :movies="movies" @keep="decide($event, 'watchlist')" @pass="decide($event, 'archived')" @open="sheet.open" />
      <DeckControls :movie="top" @pass="deck?.pass()" @keep="deck?.keep()" @open="sheet.open(top)" @trailer="sheet.playTrailer(top)" />
      <button
        v-if="history.length"
        type="button"
        @click="takeBack"
        class="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] text-mist hover:text-cream"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="size-4"><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
        {{ t('deck.undo', { title: history.at(-1).title }) }}
      </button>
    </template>

    <template v-else>
      <EmptyState :title="t('catchup.emptyTitle')" :hint="t('catchup.emptyHint')" />
      <button v-if="history.length" type="button" @click="takeBack" class="mx-auto -mt-10 text-[14px] text-mist hover:text-cream">{{ t('deck.undo', { title: history.at(-1).title }) }}</button>
    </template>

    <MovieSheet :movie="sheet.selected.value" @close="sheet.close" @trailer="sheet.playTrailer">
      <PillButton @click="fromSheet('archived')">{{ t('deck.pass') }}</PillButton>
      <PillButton primary @click="fromSheet('watchlist')">{{ t('deck.keep') }}</PillButton>
    </MovieSheet>
    <TrailerModal :youtube-key="sheet.trailer.value?.trailerYoutubeKey ?? null" :title="sheet.trailer.value?.title ?? ''" @close="sheet.stopTrailer" />
  </section>
</template>
