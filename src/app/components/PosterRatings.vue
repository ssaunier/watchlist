<script setup>
/** Allociné's ratings in a poster's bottom corner, over a scrim so they read on any artwork. */
import RatingsLine from './RatingsLine.vue'
defineProps({ ratings: { type: Array, required: true } })
</script>

<template>
  <div v-if="ratings.length" class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/95 via-ink/75 to-transparent px-2.5 pt-10 pb-2">
    <RatingsLine :ratings="ratings" stacked size="text-[12px] leading-4" />
  </div>
</template>
