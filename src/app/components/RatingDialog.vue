<script setup>
/** "Mark as watched" asks for a rating on the way. */
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import StarRating from './StarRating.vue'

const props = defineProps({ movie: { type: Object, default: null } })
const emit = defineEmits(['confirm', 'cancel'])
const { t } = useI18n()

const dialog = ref(null)
const rating = ref(null)
const note = ref('')

watch(() => props.movie, movie => {
  if (movie) {
    rating.value = movie.rating ?? null
    note.value = movie.note ?? ''
    dialog.value?.showModal()
  } else dialog.value?.close()
})

function confirm() {
  emit('confirm', { rating: rating.value, note: note.value.trim() || null })
}
</script>

<template>
  <dialog
    ref="dialog"
    class="m-0 mt-auto w-full max-w-none rounded-t-3xl bg-ink-2 p-0 text-cream sm:m-auto sm:max-w-md sm:rounded-3xl"
    @cancel.prevent="emit('cancel')"
    @click.self="emit('cancel')"
  >
    <form v-if="movie" method="dialog" class="px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6" @submit.prevent="confirm">
      <h2 class="display text-2xl text-cream">{{ t('rating.title') }}</h2>
      <p class="mt-1 text-[15px] text-mist">{{ t('rating.hint', { title: movie.title }) }}</p>

      <div class="mt-5 flex items-center justify-between gap-3">
        <StarRating v-model="rating" interactive />
        <span class="display w-14 text-right text-2xl text-gold">{{ rating ?? '–' }}</span>
      </div>

      <textarea
        v-model="note"
        rows="2"
        :placeholder="t('rating.notePlaceholder')"
        class="mt-4 w-full rounded-2xl border border-ink-3 bg-ink px-3 py-2 text-[15px] placeholder:text-mist/70 focus:border-mist focus:outline-none"
      ></textarea>

      <div class="mt-5 flex justify-end gap-2">
        <button type="button" @click="emit('cancel')" class="rounded-full px-4 py-2 text-[15px] font-semibold text-mist hover:text-cream">{{ t('common.cancel') }}</button>
        <button type="submit" class="rounded-full bg-gold px-5 py-2 text-[15px] font-bold text-gold-deep">{{ t('rating.confirm') }}</button>
      </div>
    </form>
  </dialog>
</template>
