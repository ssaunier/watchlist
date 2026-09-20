<script setup>
/** Ten stars, read-only unless `interactive`; then each star is a button. */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  modelValue: { type: Number, default: null },
  interactive: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()
const hovered = ref(null)

const lit = n => n <= (hovered.value ?? props.modelValue ?? 0)
</script>

<template>
  <div class="flex items-center" :role="interactive ? 'radiogroup' : undefined" @mouseleave="hovered = null">
    <component
      :is="interactive ? 'button' : 'span'"
      v-for="n in 10"
      :key="n"
      :type="interactive ? 'button' : undefined"
      :role="interactive ? 'radio' : undefined"
      :aria-checked="interactive ? modelValue === n : undefined"
      :aria-label="interactive ? t('rating.star', { n }) : undefined"
      :class="['leading-none transition-colors', interactive ? 'px-0.5 py-1 text-[1.65rem]' : 'text-sm', lit(n) ? 'text-gold' : 'text-ink-3']"
      @click="interactive && emit('update:modelValue', n)"
      @mouseenter="interactive && (hovered = n)"
      @focus="interactive && (hovered = n)"
    >★</component>
  </div>
</template>
