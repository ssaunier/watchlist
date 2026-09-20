<script setup>
/** The door: one field, one button, over everything else. */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth.js'

const { t } = useI18n()
const { login } = useAuth()
const password = ref('')
const wrong = ref(false)
const busy = ref(false)

async function submit() {
  if (!password.value || busy.value) return
  busy.value = true
  wrong.value = false
  try {
    await login(password.value)
  } catch {
    wrong.value = true
    busy.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 grid place-items-center bg-ink px-6 text-cream">
    <form class="w-full max-w-xs" @submit.prevent="submit">
      <h1 class="display mb-6 text-4xl">{{ t('app.title') }}</h1>
      <p v-if="wrong" class="mb-4 text-[14px] text-gold">{{ t('login.wrong') }}</p>
      <label for="password" class="mb-1.5 block text-[14px] text-mist">{{ t('login.label') }}</label>
      <input
        id="password"
        v-model="password"
        type="password"
        autocomplete="current-password"
        autofocus
        required
        class="w-full rounded-2xl border border-ink-3 bg-ink-2 px-4 py-3 text-lg focus:border-mist focus:outline-none"
      />
      <button type="submit" :disabled="busy" class="mt-4 w-full rounded-full bg-gold py-3 text-[15px] font-bold text-gold-deep disabled:opacity-60">{{ t('login.enter') }}</button>
    </form>
  </div>
</template>
