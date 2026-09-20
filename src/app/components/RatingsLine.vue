<script setup>
/** "★ 3,9 presse   ★ 3,8 spectateurs": Allociné's two ratings out of 5, when known. */
defineProps({ ratings: { type: Array, required: true }, size: { type: String, default: 'text-[13px]' } })
</script>

<template>
  <p v-if="ratings.length" :class="['flex flex-wrap gap-x-3 gap-y-0.5', size]">
    <span v-for="entry in ratings" :key="entry.key" class="inline-flex items-baseline gap-1 whitespace-nowrap">
      <span class="text-gold">★</span>
      <span class="font-semibold text-cream">{{ entry.text }}</span>
      <span class="text-mist">{{ entry.label }}</span>
    </span>
  </p>
</template>
