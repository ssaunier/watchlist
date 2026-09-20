<script setup>
/**
 * One film at a time. Drag right to keep, left to pass; the next poster
 * waits underneath. The buttons under the deck fly the card the same way.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSwipe, KEEP, PASS } from '../composables/useSwipe.js'
import PosterCard from './PosterCard.vue'

const props = defineProps({ movies: { type: Array, required: true } })
const emit = defineEmits(['keep', 'pass', 'open'])
const { t } = useI18n()

const top = computed(() => props.movies[0] || null)
const next = computed(() => props.movies[1] || null)

const { style, keepOpacity, passOpacity, moved, flyOut, handlers, state } = useSwipe(direction => {
  if (!top.value) return
  emit(direction === KEEP ? 'keep' : 'pass', top.value)
})

function open() {
  if (!moved.value && !state.leaving && top.value) emit('open', top.value)
}

function onKeydown(event) {
  if (event.key === 'ArrowRight') flyOut(KEEP)
  else if (event.key === 'ArrowLeft') flyOut(PASS)
  else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    open()
  }
}

defineExpose({ keep: () => flyOut(KEEP), pass: () => flyOut(PASS) })
</script>

<template>
  <div class="relative mx-auto w-full max-w-[26rem]" style="aspect-ratio: 2 / 3; max-height: calc(100dvh - 17.5rem);">
    <!-- The card underneath, slightly smaller so the stack reads as a stack. -->
    <div v-if="next" class="absolute inset-0 scale-[0.94] translate-y-3 opacity-80">
      <PosterCard :movie="next" muted />
    </div>

    <div
      v-if="top"
      :key="top.tmdbId"
      class="absolute inset-0 cursor-grab touch-pan-y select-none active:cursor-grabbing"
      :style="style"
      tabindex="0"
      role="group"
      :aria-label="top.title"
      v-on="handlers"
      @click="open"
      @keydown="onKeydown"
    >
      <PosterCard :movie="top" />

      <span
        class="display absolute top-6 left-5 -rotate-12 rounded-lg border-[3px] border-gold px-3 py-1 text-3xl text-gold"
        :style="{ opacity: keepOpacity }"
        aria-hidden="true"
      >{{ t('deck.keep') }}</span>
      <span
        class="display absolute top-6 right-5 rotate-12 rounded-lg border-[3px] border-mist px-3 py-1 text-3xl text-mist"
        :style="{ opacity: passOpacity }"
        aria-hidden="true"
      >{{ t('deck.pass') }}</span>
    </div>
  </div>
</template>
