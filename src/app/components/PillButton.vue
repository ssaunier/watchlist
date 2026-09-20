<script setup>
/** Actions in sheets and rows: gold when it is the one thing to do, quiet otherwise. */
defineProps({ primary: { type: Boolean, default: false } })
</script>

<template>
  <button
    type="button"
    :class="['rounded-full px-4 py-2 text-[15px] font-semibold transition', primary ? 'bg-gold text-gold-deep hover:brightness-105' : 'border border-ink-3 text-cream hover:border-mist']"
  >
    <slot />
  </button>
</template>
