<script setup>
defineProps({ title: { type: String, required: true }, hint: { type: String, default: '' } })
</script>

<template>
  <div class="mx-auto max-w-xs px-6 py-20 text-center">
    <p class="display text-2xl text-cream">{{ title }}</p>
    <p v-if="hint" class="mt-2 text-[15px] leading-6 text-mist">{{ hint }}</p>
  </div>
</template>
