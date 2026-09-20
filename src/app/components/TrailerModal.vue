<script setup>
/**
 * The trailer, in place. The iframe exists only while the dialog is open,
 * so closing it stops the sound as well as the picture. Focus stays on the
 * close button: a focused YouTube iframe keeps the Escape key for itself
 * and the dialog would never hear it.
 */
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { trailerEmbedUrl } from '../services/images.js'

const props = defineProps({ youtubeKey: { type: String, default: null }, title: { type: String, default: '' } })
const emit = defineEmits(['close'])
const { t } = useI18n()
const dialog = ref(null)

watch(() => props.youtubeKey, key => {
  if (key) dialog.value?.showModal()
  else dialog.value?.close()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto w-[min(100vw,64rem)] max-w-none bg-transparent p-0"
    @cancel.prevent="emit('close')"
    @click.self="emit('close')"
  >
    <div v-if="youtubeKey" class="relative">
      <div class="aspect-video w-full overflow-hidden bg-black sm:rounded-2xl">
        <iframe
          :src="trailerEmbedUrl(youtubeKey)"
          :title="title"
          class="size-full"
          tabindex="-1"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowfullscreen
          referrerpolicy="strict-origin-when-cross-origin"
        ></iframe>
      </div>
      <button
        type="button"
        autofocus
        @click="emit('close')"
        :aria-label="t('common.close')"
        class="absolute -top-12 right-2 grid size-10 place-items-center rounded-full bg-ink-2 text-cream sm:-right-2"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" class="size-5"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
  </dialog>
</template>
