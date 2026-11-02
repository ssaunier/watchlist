<script setup>
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMovies } from '../composables/useMovies.js'
import { useLocale } from '../composables/useLocale.js'
import { useSheet } from '../composables/useSheet.js'
import { useBreakpoint } from '../composables/useBreakpoint.js'
import { releaseWeek } from '../services/dates.js'
import SwipeDeck from '../components/SwipeDeck.vue'
import DeckControls from '../components/DeckControls.vue'
import NewBrowse from '../components/NewBrowse.vue'
import MovieSheet from '../components/MovieSheet.vue'
import TrailerModal from '../components/TrailerModal.vue'
import PillButton from '../components/PillButton.vue'
import EmptyState from '../components/EmptyState.vue'

const { t } = useI18n()
const { collator } = useLocale()
const { lists, loading, counts, load, move, undo } = useMovies()
const sheet = useSheet()
const { isDesktop } = useBreakpoint()
const deck = ref(null)

/** Newest release week first; inside a week the most talked-about film first. */
const movies = computed(() =>
  [...(lists.new || [])].sort((a, b) => {
    const week = releaseWeek(b.releases[0]?.date || b.primaryReleaseDate || '').localeCompare(releaseWeek(a.releases[0]?.date || a.primaryReleaseDate || ''))
    return week || (b.voteCount ?? 0) - (a.voteCount ?? 0) || collator.value.compare(a.title, b.title)
  })
)

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

/** From the sheet: on a phone the deck animates the top card away, on a desktop the film just goes. */
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
  await undo(movie)
}

onMounted(() => load('new'))
</script>

<template>
  <section class="flex flex-col">
    <div v-if="loading.new && !movies.length" class="py-24 text-center text-[15px] text-mist">{{ t('app.loading') }}</div>

    <template v-else-if="top && isDesktop">
      <header class="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <h1 class="display text-3xl text-cream">{{ t('deck.title') }}</h1>
          <p class="mt-1 text-[14px] text-mist">{{ t('deck.remaining', { n: movies.length }) }}</p>
        </div>
        <button v-if="history.length" type="button" @click="takeBack" class="text-[14px] text-mist hover:text-cream">{{ t('deck.undo', { title: history.at(-1).title }) }}</button>
      </header>
      <NewBrowse :movies="movies" @keep="decide($event, 'watchlist')" @pass="decide($event, 'archived')" @open="sheet.open" />
    </template>

    <template v-else-if="top">
      <p class="mb-3 text-center text-[13px] text-mist">{{ t('deck.remaining', { n: movies.length }) }}</p>

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
      <EmptyState :title="t('deck.emptyTitle')" :hint="t('deck.emptyHint')" />
      <button v-if="history.length" type="button" @click="takeBack" class="mx-auto -mt-10 text-[14px] text-mist hover:text-cream">{{ t('deck.undo', { title: history.at(-1).title }) }}</button>
      <RouterLink v-if="counts.archived" to="/archive" class="mx-auto mt-6 text-[14px] text-mist underline decoration-ink-3 underline-offset-4 hover:text-cream">{{ t('app.archivedLink', { n: counts.archived }) }}</RouterLink>
    </template>

    <MovieSheet :movie="sheet.selected.value" @close="sheet.close" @trailer="sheet.playTrailer">
      <PillButton @click="fromSheet('archived')">{{ t('deck.pass') }}</PillButton>
      <PillButton primary @click="fromSheet('watchlist')">{{ t('deck.keep') }}</PillButton>
    </MovieSheet>
    <TrailerModal :youtube-key="sheet.trailer.value?.trailerYoutubeKey ?? null" :title="sheet.trailer.value?.title ?? ''" @close="sheet.stopTrailer" />
  </section>
</template>
