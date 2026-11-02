<script setup>
/** Under the deck on a phone: pass, the synopsis and the trailer, keep. */
import { useI18n } from 'vue-i18n'
import { useLocale } from '../composables/useLocale.js'
import { trailerSearchUrl } from '../services/images.js'

defineProps({ movie: { type: Object, required: true } })
defineEmits(['pass', 'keep', 'open', 'trailer'])
const { t } = useI18n()
const { locale } = useLocale()
</script>

<template>
  <div class="mx-auto mt-5 flex w-full max-w-[26rem] items-center justify-between px-2">
    <button
      type="button"
      @click="$emit('pass')"
      :aria-label="t('deck.pass')"
      class="grid size-16 place-items-center rounded-full border-2 border-ink-3 text-mist transition hover:border-mist hover:text-cream active:scale-95"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" class="size-7"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>

    <div class="flex flex-col items-center gap-1 text-[14px]">
      <button type="button" @click="$emit('open')" class="rounded-full px-3 py-1 text-cream/90 hover:text-cream">{{ t('deck.synopsis') }}</button>
      <button v-if="movie.trailerYoutubeKey" type="button" @click="$emit('trailer')" class="rounded-full px-3 py-1 text-cream/90 hover:text-cream">{{ t('film.trailer') }}</button>
      <a v-else :href="trailerSearchUrl(movie, locale)" target="_blank" rel="noreferrer" class="rounded-full px-3 py-1 text-mist hover:text-cream">{{ t('film.findTrailer') }}</a>
    </div>

    <button
      type="button"
      @click="$emit('keep')"
      :aria-label="t('deck.keep')"
      class="grid size-16 place-items-center rounded-full bg-gold text-gold-deep shadow-[0_10px_30px_-10px_rgb(233_185_73/0.6)] transition hover:brightness-105 active:scale-95"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="size-7"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
    </button>
  </div>
</template>
