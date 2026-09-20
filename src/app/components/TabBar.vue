<script setup>
/** The three lists, where a thumb can reach them. */
import { RouterLink, useRoute } from 'vue-router'
defineProps({ tabs: { type: Array, required: true } })
const route = useRoute()
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-30 border-t border-ink-3/60 bg-ink/90 backdrop-blur pb-[env(safe-area-inset-bottom)]">
    <div class="mx-auto flex max-w-2xl">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.name"
        :to="tab.to"
        :aria-current="route.name === tab.name ? 'page' : undefined"
        :class="['flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[13px] transition-colors', route.name === tab.name ? 'text-cream' : 'text-mist']"
      >
        <span :class="['display text-[19px]', route.name === tab.name ? 'text-cream' : 'text-mist']">{{ tab.label }}</span>
        <span :class="['h-4 text-[12px] leading-4', tab.count ? (tab.accent ? 'text-gold' : 'text-mist') : 'invisible']">{{ tab.count || 0 }}</span>
      </RouterLink>
    </div>
  </nav>
</template>
