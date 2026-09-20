<script setup>
import { computed, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMovies } from './composables/useMovies.js'
import { useLocale } from './composables/useLocale.js'
import { useAuth } from './composables/useAuth.js'
import TabBar from './components/TabBar.vue'
import LoginScreen from './components/LoginScreen.vue'

const { counts, error, refreshStatus } = useMovies()
const { locales, locale, setLocale } = useLocale()
const { t } = useI18n()
const route = useRoute()
const { locked } = useAuth()

const tabs = computed(() => [
  { to: '/', name: 'new', label: t('nav.new'), count: counts.new, accent: true },
  { to: '/watchlist', name: 'watchlist', label: t('nav.watchlist'), count: counts.watchlist },
  { to: '/watched', name: 'watched', label: t('nav.watched'), count: counts.watched }
])

onMounted(() => refreshStatus())
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-ink text-cream">
    <LoginScreen v-if="locked" />
    <header class="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 sm:px-6 md:py-5">
      <RouterLink to="/" class="display text-[22px] text-cream">{{ t('app.title') }}</RouterLink>
      <!-- On a wide screen the lists sit up here; on a phone, in the bar at the bottom. -->
      <nav class="hidden items-center gap-6 md:flex">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.name"
          :to="tab.to"
          :aria-current="route.name === tab.name ? 'page' : undefined"
          :class="['display text-[19px] transition-colors', route.name === tab.name ? 'text-cream' : 'text-mist hover:text-cream']"
        >{{ tab.label }} <span v-if="tab.count" :class="['ml-1 font-sans text-[13px]', tab.accent ? 'text-gold' : 'text-mist']">{{ tab.count }}</span></RouterLink>
      </nav>
      <div class="flex items-center gap-4 text-[13px] text-mist">
        <RouterLink to="/archive" :class="['hover:text-cream', route.name === 'archived' ? 'text-cream' : '']">{{ t('app.archivedLink', { n: counts.archived }) }}</RouterLink>
        <nav :aria-label="t('app.language')" class="flex items-center gap-2">
          <button
            v-for="code in locales"
            :key="code"
            type="button"
            @click="setLocale(code)"
            :aria-current="locale === code ? 'true' : undefined"
            :class="['uppercase', locale === code ? 'text-cream' : 'hover:text-cream']"
          >{{ code }}</button>
        </nav>
      </div>
    </header>

    <main class="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-2 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-10">
      <div v-if="error" class="mb-4 rounded-2xl border border-gold/40 bg-ink-2 px-4 py-3 text-[14px] text-cream">
        {{ t('app.errorTitle') }}: {{ error }}
        <button type="button" @click="error = null" class="ml-2 font-semibold text-gold">{{ t('common.dismiss') }}</button>
      </div>
      <RouterView />
    </main>

    <TabBar :tabs="tabs" class="md:hidden" />
  </div>
</template>
